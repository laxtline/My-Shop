import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { OrderModel } from '../models/Order.js';
import { ProductModel } from '../models/Product.js';
import { UserModel } from '../models/User.js';
import { CouponModel } from '../models/Coupon.js';
import { CouponUsageModel } from '../models/CouponUsage.js';
import { ReturnModel } from '../models/Return.js';
import { RefundModel } from '../models/Refund.js';
import { ApiError } from '../utils/ApiError.js';
import { cursorFilter, cursorPage, getPageParams } from '../utils/pagination.js';
import { sendOrderPlacedEmail, sendOrderStatusEmail } from '../utils/email.js';
import { resolveCoupon } from '../services/coupons.js';
import { priceCart } from '../services/cartPricing.js';
import { money, calculateDeliveryFee } from '@shared/pricing.js';
import { notifyNewOrder, notifyOrderStatusChange, notifyAdmins } from '../services/push.js';
import { getEncryptionService } from '../services/encryption.js';
import { env, razorpayEnabled } from '../config/env.js';
import { shipmentSummary, cancelShipmentForOrder, getShippingSettings } from '../services/shipping/index.js';
import { createCancellationRefund, refundRazorpayPayment } from '../services/refunds.js';
import { ShipmentModel } from '../models/Shipment.js';
import type { OrderStatus, ShippingAddress, ReturnStatus } from '@shared/types/index.js';

const sort = { field: 'createdAt', direction: -1, kind: 'date' } as const;
// TODO: move STATUS_FLOW to shared constants so frontend/admin stay in sync
const STATUS_FLOW: Record<OrderStatus, OrderStatus[]> = {
  PLACED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PACKED', 'CANCELLED'],
  PACKED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['OUT_FOR_DELIVERY'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

function validateAddress(input: unknown): ShippingAddress {
  const a = (input ?? {}) as Record<string, string>;
  for (const key of ['fullName', 'phone', 'line1', 'city', 'state', 'pincode']) {
    if (typeof a[key] !== 'string' || !a[key].trim()) throw new ApiError(400, `Shipping address: ${key} is required.`);
  }
  if (!/^[1-9]\d{5}$/.test(a.pincode.trim())) throw new ApiError(400, 'Pincode must be 6 digits.');
  if (!/^[6-9]\d{9}$/.test(a.phone.trim())) throw new ApiError(400, 'A valid 10-digit mobile number is required.');
  return { fullName: a.fullName.trim(), phone: a.phone.trim(), line1: a.line1.trim(), line2: (a.line2 ?? '').trim(),
    city: a.city.trim(), state: a.state.trim(), pincode: a.pincode.trim() };
}

function addStatusHistory(order: any, status: OrderStatus, note: string, userId: string) {
  const history = order.statusHistory ?? [];
  history.push({ status, timestamp: new Date(), note });
  order.statusHistory = history;
}

export async function createOrder(req: Request, res: Response) {
  const userId = String(req.user!._id);
  const shippingAddress = validateAddress(req.body.shippingAddress);
  const paymentMethod = req.body.paymentMethod === 'RAZORPAY' ? 'RAZORPAY' : 'COD';
  const requestedChannel = String(req.body.paymentChannel ?? '').toUpperCase();
  const paymentChannel = paymentMethod === 'COD'
    ? 'COD'
    : (['UPI', 'CARD', 'NETBANKING', 'WALLET'].includes(requestedChannel) ? requestedChannel : 'UNKNOWN');
  const notes = String(req.body.notes ?? '').slice(0, 500);
  const code = String(req.body.couponCode ?? '').trim();

  // Validate serviceability and COD availability against the shop's live
  // shipping policy (not a hard-coded table).
  const settings = await getShippingSettings();
  const deliveryConfig = {
    baseFee: settings.baseDeliveryFee,
    freeOver: settings.freeDeliveryOver,
    serviceablePincodes: settings.serviceablePincodes,
    noCodPincodes: settings.noCodPincodes,
  };
  const { codAvailable, serviceable } = calculateDeliveryFee(0, shippingAddress.pincode, deliveryConfig);
  if (!serviceable) {
    throw new ApiError(400, `Delivery is not available to pincode ${shippingAddress.pincode}.`);
  }
  if (paymentMethod === 'COD' && (!settings.codEnabled || !codAvailable)) {
    throw new ApiError(400, `Cash on Delivery is not available for pincode ${shippingAddress.pincode}. Please choose online payment.`);
  }
  const codFee = paymentMethod === 'COD' ? settings.codFee : 0;

  // transaction prevents overselling, double checkout, coupon limit races
  const order = await mongoose.connection.transaction(async (session) => {
    const priced = await priceCart(userId, session, shippingAddress.pincode, deliveryConfig);
    const resolved = code ? await resolveCoupon(code, userId, priced, session) : null;
    for (const line of priced.items) {
      const stock = await ProductModel.updateOne({ _id: line.product, isActive: true, stock: { $gte: line.quantity } },
        { $inc: { stock: -line.quantity } }, { session });
      if (!stock.modifiedCount) throw new ApiError(409, `"${line.title}" has insufficient stock. Update your cart.`);
    }
    const discount = resolved?.discount ?? 0;
    const now = new Date();
    const [created] = await OrderModel.create([{
      user: userId, items: priced.items, shippingAddress, paymentMethod, paymentStatus: 'PENDING', status: 'PLACED',
      paymentChannel,
      itemsTotal: priced.itemsTotal, deliveryFee: priced.deliveryFee, discount,
      coupon: resolved?.coupon._id ?? null, couponCode: resolved?.coupon.code ?? '',
      couponSnapshot: resolved ? { code: resolved.coupon.code, description: resolved.coupon.description,
        type: resolved.coupon.type, value: resolved.coupon.value, maxDiscount: resolved.coupon.maxDiscount,
        scope: resolved.coupon.scope, eligibleTotal: resolved.eligibleTotal } : null,
      total: money(priced.itemsTotal + priced.deliveryFee - discount + codFee), notes,
      statusHistory: [{ status: 'PLACED', timestamp: now, note: 'Order placed' }],
    }], { session });
    if (resolved) {
      await CouponModel.updateOne({ _id: resolved.coupon._id },
        { $inc: { totalUses: 1, totalDiscount: discount } }, { session });
      await CouponUsageModel.create([{
        coupon: resolved.coupon._id, user: userId, order: created._id,
        couponCode: resolved.coupon.code, customerName: req.user!.name,
        customerEmail: req.user!.email, discount,
        orderTotal: created.total,
      }], { session });
    }
    priced.cart.set('items', []);
    priced.cart.lastUpdatedAt = new Date();
    await priced.cart.save({ session });
    return created;
  });

  // fire and forget
  void sendOrderPlacedEmail(req.user!.email, order);
  void notifyNewOrder(order._id.toString(), req.user!.name, order.total);

  res.status(201).json({ success: true, data: order, message: 'Order placed successfully.' });
  // console.log('[order] created:', order._id); // debug
}

export async function listMyOrders(req: Request, res: Response) {
  const { page, limit, skip } = getPageParams(req, 10, 50);
  const filter = { user: req.user!._id };
  const scope = { user: String(req.user!._id) };
  const [rows, total] = await Promise.all([
    OrderModel.find({ $and: [filter, cursorFilter(req, sort, scope)] }).sort({ createdAt: -1, _id: -1 })
      .skip(req.query.cursor ? 0 : skip).limit(limit + 1), OrderModel.countDocuments(filter),
  ]);
  res.json({ success: true, data: cursorPage(rows, total, page, limit, sort, scope) });
}

export async function getOrder(req: Request, res: Response) {
  const order = await OrderModel.findById(req.params.id).populate('user', 'name email');
  if (!order) throw new ApiError(404, 'Order not found.');
  if (String(order.user._id) !== String(req.user!._id) && req.user!.role !== 'ADMIN') throw new ApiError(403, 'Not allowed.');

  const shipment = order.shipment ? await ShipmentModel.findById(order.shipment) : null;
  res.json({
    success: true,
    data: { ...order.toObject(), shipment: shipment ? shipmentSummary(shipment) : null },
  });
}

async function changeStatus(req: Request, next: OrderStatus, ownerOnly: boolean) {
  const order = await mongoose.connection.transaction(async (session) => {
    const current = await OrderModel.findById(req.params.id).session(session);
    if (!current) throw new ApiError(404, 'Order not found.');
    if (ownerOnly && String(current.user) !== String(req.user!._id)) throw new ApiError(403, 'Not allowed.');
    if (!STATUS_FLOW[current.status as OrderStatus]?.includes(next)) throw new ApiError(400, `Cannot change status from ${current.status} to ${next}.`);

    // Prevent fulfilling unpaid prepaid orders
    if (current.paymentMethod === 'RAZORPAY' && current.paymentStatus !== 'PAID') {
      // Allow cancellation of unpaid orders, but block fulfillment
      if (next !== 'CANCELLED') {
        throw new ApiError(400, 'Cannot advance unpaid online order. Payment must be completed first.');
      }
    }

    // Prevent *new* online payments when the gateway is disabled, but never
    // block fulfilment of an order that is already PAID just because keys were
    // rotated or temporarily removed from the environment.
    if (current.paymentMethod === 'RAZORPAY' && !razorpayEnabled && current.paymentStatus !== 'PAID') {
      if (next !== 'CANCELLED') {
        throw new ApiError(503, 'Online payment is not available. Cannot process this order.');
      }
    }

    if (next === 'CANCELLED') {
      for (const line of current.items) {
        if (line.product) await ProductModel.updateOne({ _id: line.product }, { $inc: { stock: line.quantity } }, { session });
      }
    }
    const note = String(req.body.note ?? '').slice(0, 500);
    current.status = next;
    addStatusHistory(current, next, note || `Status changed to ${next}`, String(req.user!._id));

    // For COD, do NOT auto-mark as PAID on DELIVERED - requires separate cash collection
    // Payment collection for COD should be tracked separately
    if (next === 'DELIVERED' && current.paymentMethod === 'COD' && current.paymentStatus !== 'PAID') {
      current.paymentStatus = 'PENDING'; // Keep as PENDING for cash collection tracking
    }
    await current.save({ session });
    return current;
  });
  if (next === 'CANCELLED') {
    // Stop the carrier first; a cancelled order must not keep moving.
    await cancelShipmentForOrder(order._id.toString());
    // A prepaid order that is cancelled must get its money back automatically.
    if (order.paymentMethod === 'RAZORPAY' && order.paymentStatus === 'PAID' && order.razorpayPaymentId) {
      try {
        await createCancellationRefund(order, 'Order cancelled');
      } catch (error) {
        console.error('[order] Automatic cancellation refund failed:', error);
      }
    }
  }

  const owner = await UserModel.findById(order.user).select('email');
  if (owner?.email) void sendOrderStatusEmail(owner.email, order);
  // push for admin-initiated status changes
  if (!ownerOnly) {
    void notifyOrderStatusChange(order._id.toString(), order.status, order.shippingAddress.fullName);
  }
  return order;
}

/**
 * PATCH /api/orders/:id/cod-collected — Admin records cash handed over by the
 * delivery agent. Without this step, a delivered COD order stays PENDING and
 * revenue reports cannot distinguish cash collected from cash still owed.
 */
export async function markCodCollected(req: Request, res: Response) {
  const order = await OrderModel.findById(req.params.id);
  if (!order) throw new ApiError(404, 'Order not found.');
  if (order.paymentMethod !== 'COD') throw new ApiError(400, 'This is not a Cash on Delivery order.');
  if (order.status !== 'DELIVERED') throw new ApiError(400, 'Cash can be recorded after the order is delivered.');
  if (order.paymentStatus === 'PAID') throw new ApiError(400, 'Cash was already recorded for this order.');

  const now = new Date();
  order.paymentStatus = 'PAID';
  order.paymentChannel = 'COD';
  order.paidAt = now;
  order.codCollectedAt = now;
  addStatusHistory(order, 'DELIVERED', `COD collected: ₹${order.total.toLocaleString('en-IN')}`, String(req.user!._id));
  await order.save();

  const owner = await UserModel.findById(order.user).select('email');
  if (owner?.email) void sendOrderStatusEmail(owner.email, order);
  res.json({ success: true, data: order, message: 'Cash collection recorded.' });
}

export async function cancelOrder(req: Request, res: Response) {
  const order = await changeStatus(req, 'CANCELLED', true);
  res.json({ success: true, data: order, message: 'Order cancelled.' });
}

export async function listAllOrders(req: Request, res: Response) {
  const { page, limit, skip } = getPageParams(req, 15, 100);
  const filter: Record<string, unknown> = {};
  const status = String(req.query.status ?? '').toUpperCase();
  if (status && !(status in STATUS_FLOW)) throw new ApiError(400, 'Invalid order status.');
  if (status) filter.status = status;
  const [rows, total] = await Promise.all([
    OrderModel.find({ $and: [filter, cursorFilter(req, sort, filter)] }).populate('user', 'name email')
      .sort({ createdAt: -1, _id: -1 }).skip(req.query.cursor ? 0 : skip).limit(limit + 1),
    OrderModel.countDocuments(filter),
  ]);
  res.json({ success: true, data: cursorPage(rows, total, page, limit, sort, filter) });
}

export async function updateOrderStatus(req: Request, res: Response) {
  const next = String(req.body.status).toUpperCase() as OrderStatus;
  const order = await changeStatus(req, next, false);
  res.json({ success: true, data: order, message: `Order marked ${next}.` });
}

export async function orderAnalytics(_req: Request, res: Response) {
  // 30-day window, IST dates. MongoDB aggregates, no order arrays in memory.
  const since = new Date(Date.now() - 30 * 86400000);
  // Exclude cancelled orders and unpaid/failed online orders from revenue
  const match = {
    status: { $ne: 'CANCELLED' },
    createdAt: { $gte: since },
    $or: [
      { paymentMethod: 'COD' }, // COD orders included regardless of paymentStatus
      { paymentMethod: 'RAZORPAY', paymentStatus: 'PAID' }, // Only PAID online orders (exclude FAILED)
    ],
  };
  const [days, top, coupons] = await Promise.all([
    OrderModel.aggregate([
      { $match: match }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } },
        revenue: { $sum: '$total' }, orders: { $sum: 1 } } }, { $sort: { _id: 1 } },
    ]),
    OrderModel.aggregate([
      { $match: match }, { $unwind: '$items' }, { $group: { _id: '$items.product', title: { $first: '$items.title' },
        qty: { $sum: '$items.quantity' }, revenue: { $sum: '$items.lineTotal' } } }, { $sort: { qty: -1, _id: 1 } }, { $limit: 10 },
    ]).allowDiskUse(true),
    OrderModel.aggregate([
      { $match: { ...match, couponCode: { $ne: '' } } }, { $group: { _id: '$couponCode', uses: { $sum: 1 }, discount: { $sum: '$discount' } } },
      { $sort: { uses: -1, _id: 1 } }, { $limit: 10 },
    ]).allowDiskUse(true),
  ]);
  res.json({ success: true, data: {
    revenueByDay: days.map((r) => ({ date: r._id, revenue: r.revenue, orders: r.orders })),
    topProducts: top.map((p) => ({ title: p.title, qty: p.qty, revenue: p.revenue })),
    couponUsage: coupons.map((c) => ({ code: c._id, uses: c.uses, discount: c.discount })),
  } });
}

export async function orderStats(_req: Request, res: Response) {
  // Match the same criteria as orderAnalytics: exclude cancelled and unpaid/failed online orders from revenue
  const match = {
    $or: [
      { paymentMethod: 'COD' },
      { paymentMethod: 'RAZORPAY', paymentStatus: 'PAID' }, // Only PAID online orders (exclude FAILED)
    ],
  };
  const [rows] = await OrderModel.aggregate([{ $facet: {
    statuses: [{ $match: { status: { $ne: 'CANCELLED' } } }, { $group: { _id: '$status', count: { $sum: 1 } } }],
    sales: [{ $match: { ...match, status: { $ne: 'CANCELLED' } } }, { $group: { _id: null,
      sales: { $sum: { $sum: '$items.quantity' } }, revenue: { $sum: '$total' },
      couponUses: { $sum: { $cond: [{ $ne: ['$couponCode', ''] }, 1, 0] } }, discountGiven: { $sum: '$discount' },
    } }],
  } }]);
  const statusCounts: Record<string, number> = {};
  for (const r of rows?.statuses ?? []) statusCounts[r._id] = r.count;
  res.json({ success: true, data: { totalOrders: Object.values(statusCounts).reduce((a, b) => a + b, 0),
    revenue: rows?.sales[0]?.revenue ?? 0, sales: rows?.sales[0]?.sales ?? 0,
    couponUses: rows?.sales[0]?.couponUses ?? 0, discountGiven: rows?.sales[0]?.discountGiven ?? 0, statusCounts } });
}

// PUT /api/orders/:id/courier — Admin only. Update courier name, tracking ID, and tracking URL.
export async function updateCourierInfo(req: Request, res: Response) {
  const { courierName, trackingId, trackingUrl } = req.body as {
    courierName?: string; trackingId?: string; trackingUrl?: string;
  };
  if (!courierName?.trim() && !trackingId?.trim()) {
    throw new ApiError(400, 'At least courier name or tracking ID is required.');
  }

  // First get the current order to know its status
  const currentOrder = await OrderModel.findById(req.params.id);
  if (!currentOrder) throw new ApiError(404, 'Order not found.');

  const updated = await OrderModel.findByIdAndUpdate(
    req.params.id,
    {
      $set: {
        'courierInfo.name': courierName?.trim() ?? '',
        'courierInfo.trackingId': trackingId?.trim() ?? '',
        'courierInfo.trackingUrl': trackingUrl?.trim() ?? '',
      },
      $push: { statusHistory: { status: currentOrder.status, timestamp: new Date(), note: `Courier info updated: ${courierName} - ${trackingId}` } },
    },
    { new: true }
  ).populate('user', 'name email');

  if (!updated) throw new ApiError(404, 'Order not found.');
  const order = updated;

  // Notify customer of tracking update
  const owner = await UserModel.findById(order.user).select('email');
  if (owner?.email) void sendOrderStatusEmail(owner.email, order);
  void notifyOrderStatusChange(order._id.toString(), `Tracking: ${courierName}`, order.shippingAddress.fullName);

  res.json({ success: true, data: order, message: 'Courier info updated.' });
}

// POST /api/orders/:id/return — Customer requests a return.
export async function requestReturn(req: Request, res: Response) {
  const userId = String(req.user!._id);
  const { reason, pickupAddress } = req.body as { reason: string; pickupAddress: ShippingAddress };

  if (!reason?.trim()) throw new ApiError(400, 'Return reason is required.');

  const order = await OrderModel.findById(req.params.id);
  if (!order) throw new ApiError(404, 'Order not found.');
  if (String(order.user) !== userId) throw new ApiError(403, 'Not allowed.');
  if (order.status !== 'DELIVERED') throw new ApiError(400, 'Only delivered orders can be returned.');
  if (order.returnRequest?.status && order.returnRequest.status !== 'REJECTED') {
    throw new ApiError(400, 'A return request already exists for this order.');
  }

  // Validate pickup address
  const validatedAddress = validateAddress(pickupAddress);

  // Create return request
  // FIXME: validate that items being returned actually exist in order
  const returnDoc = await ReturnModel.create({
    order: order._id,
    user: userId,
    items: order.items.map((item) => ({
      product: item.product,
      title: item.title,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    })),
    reason: reason.trim(),
    pickupAddress: validatedAddress,
    status: 'REQUESTED',
    statusHistory: [{ status: 'REQUESTED', timestamp: new Date(), note: 'Return requested by customer' }],
  });

  // Update order with return request
  order.returnRequest = {
    requestedAt: new Date(),
    reason: reason.trim(),
    pickupAddress: validatedAddress,
    status: 'REQUESTED',
    adminNotes: '',
  };
  addStatusHistory(order, 'DELIVERED', `Return requested: ${reason.trim()}`, userId);
  await order.save();

  // Notify admins
  void notifyAdmins(
    '🔄 Return Requested',
    `${req.user!.name} requested return for order #${order._id.toString().slice(-6).toUpperCase()}`,
    { type: 'return_request', orderId: order._id.toString(), returnId: returnDoc._id.toString() }
  );

  res.status(201).json({ success: true, data: returnDoc, message: 'Return requested. Admin will review.' });
}

// GET /api/orders/:id/return — Get return status for an order (customer or admin).
export async function getReturnStatus(req: Request, res: Response) {
  const order = await OrderModel.findById(req.params.id).select('returnRequest user');
  if (!order) throw new ApiError(404, 'Order not found.');
  if (String(order.user) !== String(req.user!._id) && req.user!.role !== 'ADMIN') {
    throw new ApiError(403, 'Not allowed.');
  }

  // Also get the Return document for full history
  const returnDoc = await ReturnModel.findOne({ order: order._id })
    .populate('refund')
    .lean();

  res.json({ success: true, data: { returnRequest: order.returnRequest, returnDoc } });
}

// GET /api/admin/returns — Admin: list all returns with filters.
export async function listReturns(req: Request, res: Response) {
  const { page, limit, skip } = getPageParams(req, 20, 100);
  const status = String(req.query.status ?? '').toUpperCase();
  const filter: Record<string, unknown> = {};
  if (status && ['REQUESTED', 'APPROVED', 'PICKUP_SCHEDULED', 'PICKED_UP', 'RECEIVED', 'REFUND_INITIATED', 'REFUNDED', 'REJECTED'].includes(status)) {
    filter.status = status;
  }

  const [rows, total] = await Promise.all([
    ReturnModel.find(filter)
      .populate('order', 'itemsTotal total couponCode')
      .populate('user', 'name email')
      .sort({ createdAt: -1, _id: -1 })
      .skip(req.query.cursor ? 0 : skip)
      .limit(limit + 1),
    ReturnModel.countDocuments(filter),
  ]);

  res.json({ success: true, data: cursorPage(rows, total, page, limit, sort, filter) });
}

// Return state machine - enforces valid transitions
const RETURN_STATUS_FLOW: Record<ReturnStatus, ReturnStatus[]> = {
  REQUESTED: ['APPROVED', 'REJECTED'],
  APPROVED: ['PICKUP_SCHEDULED', 'REJECTED'],
  PICKUP_SCHEDULED: ['PICKED_UP', 'REJECTED'],
  PICKED_UP: ['RECEIVED', 'REJECTED'],
  RECEIVED: ['REFUND_INITIATED', 'REJECTED'],
  REFUND_INITIATED: ['REFUNDED'],
  REFUNDED: [],
  REJECTED: [],
};

// PUT /api/admin/returns/:id — Admin: update return status.
export async function updateReturnStatus(req: Request, res: Response) {
  const next = String(req.body.status).toUpperCase() as ReturnStatus;
  const validStatuses = ['APPROVED', 'PICKUP_SCHEDULED', 'PICKED_UP', 'RECEIVED', 'REFUND_INITIATED', 'REFUNDED', 'REJECTED'];
  if (!validStatuses.includes(next)) throw new ApiError(400, 'Invalid return status.');

  const adminNotes = String(req.body.adminNotes ?? '').slice(0, 500);
  const courierName = String(req.body.courierName ?? '').trim();
  const trackingId = String(req.body.trackingId ?? '').trim();
  const trackingUrl = String(req.body.trackingUrl ?? '').trim();

  const returnDoc = await ReturnModel.findById(req.params.id).populate('order').populate('user', 'name email');
  if (!returnDoc) throw new ApiError(404, 'Return not found.');

  // Enforce state transitions
  const currentStatus = returnDoc.status as ReturnStatus;
  const allowedNext = RETURN_STATUS_FLOW[currentStatus] ?? [];
  if (!allowedNext.includes(next)) {
    throw new ApiError(400, `Cannot transition return from ${currentStatus} to ${next}. Allowed: ${allowedNext.join(', ')}`);
  }

  // Additional validation: REFUNDED requires a completed refund
  if (next === 'REFUNDED') {
    if (!returnDoc.refund) {
      throw new ApiError(400, 'Cannot mark as REFUNDED without an initiated refund.');
    }
    const refundDoc = await RefundModel.findById(returnDoc.refund);
    if (!refundDoc || refundDoc.status !== 'COMPLETED') {
      throw new ApiError(400, 'Cannot mark as REFUNDED until refund is completed.');
    }
  }

  const updatedReturn = await ReturnModel.findByIdAndUpdate(
    req.params.id,
    {
      $set: {
        status: next,
        adminNotes,
        ...(courierName && { courierName }),
        ...(trackingId && { trackingId }),
        ...(trackingUrl && { trackingUrl }),
      },
      $push: { statusHistory: { status: next, timestamp: new Date(), note: adminNotes || `Status changed to ${next}`, updatedBy: req.user!._id } },
    },
    { new: true }
  ).populate('order').populate('user', 'name email');

  if (!updatedReturn) throw new ApiError(404, 'Return not found.');

  // Update order's returnRequest
  const order = await OrderModel.findById(updatedReturn.order._id);
  if (order) {
    const currentReturn = order.returnRequest;
    order.returnRequest = {
      requestedAt: currentReturn?.requestedAt,
      reason: currentReturn?.reason ?? '',
      pickupAddress: currentReturn?.pickupAddress,
      status: next,
      adminNotes,
      ...(courierName && { courierName }),
      ...(trackingId && { trackingId }),
      ...(trackingUrl && { trackingUrl }),
    };
    addStatusHistory(order, order.status, `Return ${next.toLowerCase()}: ${adminNotes || ''}`, String(req.user!._id));
    await order.save();
  }

  // Notify customer
  const user = await UserModel.findById(updatedReturn.user._id).select('email name');
  if (user?.email && order) {
    void sendOrderStatusEmail(user.email, { ...order.toObject(), status: next, shippingAddress: order.shippingAddress });
  }
  const customerName = user?.name ?? 'Customer';
  void notifyOrderStatusChange(updatedReturn.order._id.toString(), `Return ${next}`, customerName);

  res.json({ success: true, data: updatedReturn, message: `Return ${next.toLowerCase()}.` });
}

// POST /api/admin/returns/:id/refund — Admin: initiate refund for a return.
export async function initiateRefund(req: Request, res: Response) {
  const { method, amount, upiId, bankAccount, bankIfsc, bankName, accountHolderName } = req.body as {
    method: 'RAZORPAY' | 'UPI' | 'BANK';
    amount: number;
    upiId?: string;
    bankAccount?: string;
    bankIfsc?: string;
    bankName?: string;
    accountHolderName?: string;
  };

  if (!['RAZORPAY', 'UPI', 'BANK'].includes(method)) throw new ApiError(400, 'Invalid refund method.');
  if (!amount || amount <= 0) throw new ApiError(400, 'Refund amount must be positive.');
  if (method === 'UPI' && !upiId?.trim()) throw new ApiError(400, 'UPI ID is required for UPI refund.');
  if (method === 'BANK' && (!bankAccount?.trim() || !bankIfsc?.trim() || !accountHolderName?.trim())) {
    throw new ApiError(400, 'Bank account, IFSC, and account holder name are required for bank refund.');
  }

  const returnDoc = await ReturnModel.findById(req.params.id).populate('order');
  if (!returnDoc) throw new ApiError(404, 'Return not found.');
  if (returnDoc.status !== 'RECEIVED' && returnDoc.status !== 'APPROVED') {
    throw new ApiError(400, 'Refund can only be initiated after return is received or approved.');
  }
  if (returnDoc.refund) throw new ApiError(400, 'Refund already initiated for this return.');

  // Validate refund amount against order's refundable amount
  const order = await OrderModel.findById(returnDoc.order._id);
  if (!order) throw new ApiError(404, 'Associated order not found.');

  // A refund can only return money the shop actually received. COD cash is
  // treated as received once the return exists (returns follow delivery); an
  // online order must have a captured payment.
  const collected = order.paymentMethod === 'RAZORPAY'
    ? (order.paymentStatus === 'PAID' ? order.total : 0)
    : order.total;

  // Never refund the same money twice: previous PENDING/COMPLETED refunds for
  // this order reduce the remaining refundable balance.
  const prior = await RefundModel.aggregate<{ total: number }>([
    { $match: { order: order._id, status: { $in: ['PENDING', 'COMPLETED'] } } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const alreadyRefunded = prior[0]?.total ?? 0;
  const maxRefundable = Math.max(0, collected - alreadyRefunded);

  if (collected === 0) {
    throw new ApiError(400, 'Cannot initiate refund: no payment captured for this order.');
  }
  if (amount > maxRefundable) {
    throw new ApiError(400, `Refund amount (₹${amount}) cannot exceed refundable amount (₹${maxRefundable}).`);
  }
  if (method === 'RAZORPAY' && !order.razorpayPaymentId) {
    throw new ApiError(400, 'This order has no Razorpay payment reference. Use a manual UPI/BANK refund.');
  }

  const encryption = getEncryptionService();
  const encryptedFields = method === 'RAZORPAY'
    ? { upiId: '', bankAccount: '', bankIfsc: '', bankName: '', accountHolderName: '' }
    : encryption.encryptFields({
      upiId: upiId ?? '',
      bankAccount: bankAccount ?? '',
      bankIfsc: bankIfsc ?? '',
      bankName: bankName ?? '',
      accountHolderName: accountHolderName ?? '',
    });

  const refundDoc = await RefundModel.create({
    return: returnDoc._id,
    order: returnDoc.order._id,
    user: returnDoc.user,
    kind: 'RETURN',
    amount,
    method,
    razorpayPaymentId: method === 'RAZORPAY' ? order.razorpayPaymentId : '',
    ...encryptedFields,
    status: 'PENDING',
  });

  // Automatic gateway refunds move money immediately; manual UPI/BANK payouts
  // stay PENDING until an admin records the transfer.
  if (method === 'RAZORPAY') {
    try {
      const result = await refundRazorpayPayment({
        paymentId: order.razorpayPaymentId,
        amount,
        notes: { orderId: String(order._id), returnId: String(returnDoc._id), reason: 'return_refund' },
      });
      refundDoc.razorpayRefundId = result.id;
      refundDoc.status = result.status === 'processed' ? 'COMPLETED' : 'PENDING';
      if (refundDoc.status === 'COMPLETED') refundDoc.processedAt = new Date();
      await refundDoc.save();
    } catch (error) {
      refundDoc.status = 'FAILED';
      refundDoc.failureReason = error instanceof Error ? error.message.slice(0, 500) : 'Gateway refund failed';
      await refundDoc.save();
      throw new ApiError(502, 'Razorpay could not process the refund. The return stays open so you can retry.');
    }
  }

  // Update return with refund reference
  returnDoc.refund = refundDoc._id;
  returnDoc.status = 'REFUND_INITIATED';
  returnDoc.statusHistory.push({ status: 'REFUND_INITIATED', timestamp: new Date(), note: `Refund initiated: ${method} ₹${amount}`, updatedBy: req.user!._id });
  await returnDoc.save();

  // Update order (re-fetch to get latest)
  const updatedOrder = await OrderModel.findById(returnDoc.order._id);
  if (updatedOrder) {
    const currentReturn = updatedOrder.returnRequest;
    updatedOrder.returnRequest = {
      requestedAt: currentReturn?.requestedAt,
      reason: currentReturn?.reason ?? '',
      pickupAddress: currentReturn?.pickupAddress,
      status: 'REFUND_INITIATED',
      adminNotes: currentReturn?.adminNotes ?? '',
    };
    updatedOrder.refund = {
      method,
      amount,
      status: refundDoc.status,
      // Encrypted fields are stored but not exposed to client
      upiIdEncrypted: encryptedFields.upiId,
      bankAccountEncrypted: encryptedFields.bankAccount,
      bankIfscEncrypted: encryptedFields.bankIfsc,
      bankNameEncrypted: encryptedFields.bankName,
      accountHolderNameEncrypted: encryptedFields.accountHolderName,
      razorpayRefundId: refundDoc.razorpayRefundId,
      refund: refundDoc._id,
      processedAt: refundDoc.processedAt ?? null,
      processedBy: req.user!._id,
    };
    addStatusHistory(
      updatedOrder,
      updatedOrder.status,
      method === 'RAZORPAY' && refundDoc.status === 'COMPLETED'
        ? `Refund completed via Razorpay — ₹${amount}`
        : `Refund initiated: ${method} ₹${amount}`,
      String(req.user!._id)
    );
    await updatedOrder.save();
  }

  // Notify customer
  const user = await UserModel.findById(returnDoc.user).select('email name');
  if (user?.email && updatedOrder) {
    void sendOrderStatusEmail(user.email, { ...updatedOrder.toObject(), status: 'REFUND_INITIATED', shippingAddress: updatedOrder.shippingAddress });
  }
  const customerName = user?.name ?? 'Customer';
  void notifyOrderStatusChange(returnDoc.order._id.toString(), `Refund Initiated: ${method} ₹${amount}`, customerName);

  res.status(201).json({
    success: true,
    data: refundDoc,
    message: method === 'RAZORPAY'
      ? (refundDoc.status === 'COMPLETED'
        ? 'Refund completed to the original payment method.'
        : 'Refund submitted to Razorpay and is being processed.')
      : 'Refund initiated. Record the transfer once paid.',
  });
}

// PUT /api/admin/refunds/:id — Admin: mark a manual refund as completed.
export async function completeRefund(req: Request, res: Response) {
  const refundDoc = await RefundModel.findByIdAndUpdate(
    req.params.id,
    {
      $set: {
        status: 'COMPLETED',
        processedAt: new Date(),
        processedBy: req.user!._id,
        adminNotes: String(req.body.adminNotes ?? '').slice(0, 500),
      },
    },
    { new: true }
  ).populate('return').populate('order').populate('user', 'name email');

  if (!refundDoc) throw new ApiError(404, 'Refund not found.');

  // Get the order first to know its current status
  const orderDoc = await OrderModel.findById(refundDoc.order._id);
  if (!orderDoc) throw new ApiError(404, 'Order not found.');

  // Update return (cancellation refunds have no physical return)
  if (refundDoc.return) {
    const returnId = (refundDoc.return as any)._id ?? refundDoc.return;
    await ReturnModel.findByIdAndUpdate(
      returnId,
      { $set: { status: 'REFUNDED' }, $push: { statusHistory: { status: 'REFUNDED', timestamp: new Date(), note: 'Refund completed', updatedBy: req.user!._id } } },
      { new: true }
    );
  }

  // Update order - use actual status instead of '$status'
  const orderUpdate: Record<string, unknown> = {
    $set: { 'refund.status': 'COMPLETED', 'refund.processedAt': new Date(), 'refund.processedBy': req.user!._id },
    $push: { statusHistory: { status: orderDoc.status, timestamp: new Date(), note: 'Refund completed', updatedBy: req.user!._id } },
  };
  if (refundDoc.return) {
    (orderUpdate.$set as Record<string, unknown>)['returnRequest.status'] = 'REFUNDED';
  }
  const order = await OrderModel.findByIdAndUpdate(refundDoc.order._id, orderUpdate, { new: true });

  // Notify customer
  const user = await UserModel.findById(refundDoc.user).select('email');
  if (user?.email && order) {
    void sendOrderStatusEmail(user.email, { ...order.toObject(), status: 'REFUNDED', shippingAddress: order.shippingAddress });
  }
  // Get customer name from populated user
  const customerName = (refundDoc.user as any)?.name ?? 'Customer';
  void notifyOrderStatusChange(refundDoc.order._id.toString(), 'Refund Completed', customerName);

  res.json({ success: true, data: refundDoc, message: 'Refund marked as completed.' });
}

// GET /api/admin/refunds — Admin: list all refunds.
export async function listRefunds(req: Request, res: Response) {
  const { page, limit, skip } = getPageParams(req, 20, 100);
  const status = String(req.query.status ?? '').toUpperCase();
  const filter: Record<string, unknown> = {};
  if (status && ['PENDING', 'COMPLETED', 'FAILED'].includes(status)) {
    filter.status = status;
  }

  const [rows, total] = await Promise.all([
    RefundModel.find(filter)
      .populate('order', 'itemsTotal total couponCode')
      .populate('user', 'name email')
      .sort({ createdAt: -1, _id: -1 })
      .skip(req.query.cursor ? 0 : skip)
      .limit(limit + 1),
    RefundModel.countDocuments(filter),
  ]);

  res.json({ success: true, data: cursorPage(rows, total, page, limit, sort, filter) });
}

// GET /api/orders/:id/track — Customer: get tracking info for order.
export async function getOrderTracking(req: Request, res: Response) {
  const order = await OrderModel.findById(req.params.id)
    .select('status courierInfo statusHistory shippingAddress items total createdAt returnRequest refund paymentMethod paymentStatus paymentChannel shipment expectedDeliveryDate')
    .populate('user', 'name email');
  if (!order) throw new ApiError(404, 'Order not found.');
  if (String(order.user._id) !== String(req.user!._id) && req.user!.role !== 'ADMIN') {
    throw new ApiError(403, 'Not allowed.');
  }

  const shipment = order.shipment ? await ShipmentModel.findById(order.shipment) : null;
  const shipmentView = shipment ? shipmentSummary(shipment) : null;

  // Prefer the carrier's own tracking page, then a known fallback by name.
  let trackingUrl = shipment?.trackingUrl || order.courierInfo.trackingUrl;
  if (!trackingUrl && order.courierInfo.trackingId) {
    const courier = order.courierInfo.name.toLowerCase();
    if (courier.includes('delhivery')) {
      trackingUrl = `https://www.delhivery.com/track/package/${encodeURIComponent(order.courierInfo.trackingId)}`;
    } else if (courier.includes('ekart')) {
      trackingUrl = `https://ekartlogistics.com/track/${encodeURIComponent(order.courierInfo.trackingId)}`;
    } else if (courier.includes('bluedart') || courier.includes('blue dart')) {
      trackingUrl = `https://www.bluedart.com/tracking?trackFor=0&trackNo=${encodeURIComponent(order.courierInfo.trackingId)}`;
    }
  }

  res.json({ success: true, data: {
    orderId: order._id,
    status: order.status,
    statusHistory: order.statusHistory,
    courier: order.courierInfo,
    trackingUrl,
    shipment: shipmentView,
    expectedDeliveryDate: shipment?.estimatedDeliveryDate ?? order.expectedDeliveryDate ?? null,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    paymentChannel: order.paymentChannel,
    shippingAddress: order.shippingAddress,
    items: order.items,
    total: order.total,
    createdAt: order.createdAt,
    returnRequest: order.returnRequest,
    refund: order.refund,
  } });
}
