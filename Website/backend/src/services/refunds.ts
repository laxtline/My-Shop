import { env, razorpayEnabled } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { RefundModel } from '../models/Refund.js';
import { ReturnModel } from '../models/Return.js';
import { OrderModel } from '../models/Order.js';

const RAZORPAY_API = 'https://api.razorpay.com/v1';

function authHeader(): string {
  return `Basic ${Buffer.from(`${env.razorpayKeyId}:${env.razorpayKeySecret}`).toString('base64')}`;
}

export interface RazorpayRefundResult {
  id: string;
  status: 'pending' | 'processed' | 'failed' | string;
  amount: number;
  paymentId: string;
}

/**
 * Refund a captured Razorpay payment back to the original instrument.
 * This is the only way an online refund actually moves money; manual UPI/BANK
 * refunds remain an explicit, separately reconciled payout.
 */
export async function refundRazorpayPayment(input: {
  paymentId: string;
  amount: number; // rupees
  notes?: Record<string, string>;
}): Promise<RazorpayRefundResult> {
  if (!razorpayEnabled) throw new ApiError(503, 'Online refunds require Razorpay credentials.');
  if (!input.paymentId) throw new ApiError(400, 'This order has no captured payment to refund.');
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new ApiError(400, 'Refund amount must be positive.');

  const response = await fetch(`${RAZORPAY_API}/payments/${encodeURIComponent(input.paymentId)}/refund`, {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: Math.round(input.amount * 100),
      speed: 'normal',
      notes: input.notes ?? {},
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new ApiError(502, `Razorpay refund failed. ${detail.slice(0, 240)}`);
  }

  const data = (await response.json()) as RazorpayRefundResult;
  return data;
}

/** Mark a stored refund complete and cascade the status to its return/order. */
export async function completeRefundRecord(refundId: string, providerRefundId?: string) {
  const refund = await RefundModel.findById(refundId);
  if (!refund) return null;
  if (refund.status !== 'COMPLETED') {
    refund.status = 'COMPLETED';
    refund.processedAt = new Date();
    if (providerRefundId) refund.razorpayRefundId = providerRefundId;
    await refund.save();
  }

  if (refund.return) {
    await ReturnModel.findByIdAndUpdate(
      refund.return,
      {
        $set: { status: 'REFUNDED' },
        $push: { statusHistory: { status: 'REFUNDED', timestamp: new Date(), note: 'Refund completed by gateway' } },
      }
    );
  }

  const order = await OrderModel.findById(refund.order);
  if (order) {
    order.refund = {
      ...(order.refund ?? {}),
      method: refund.method,
      amount: refund.amount,
      status: 'COMPLETED',
      razorpayRefundId: refund.razorpayRefundId,
      refund: refund._id,
      processedAt: new Date(),
    } as any;
    if (refund.return) {
      order.returnRequest = {
        ...(order.returnRequest ?? {}),
        status: 'REFUNDED',
      } as any;
    }
    order.statusHistory.push({
      status: order.status,
      timestamp: new Date(),
      note: `Refund completed (${refund.method}) — ₹${refund.amount.toLocaleString('en-IN')}`,
    });
    await order.save();
  }
  return refund;
}

/** Mark a stored refund failed without touching the order's paid state. */
export async function failRefundRecord(refundId: string, reason: string) {
  const refund = await RefundModel.findById(refundId);
  if (!refund || refund.status === 'COMPLETED') return refund;
  refund.status = 'FAILED';
  refund.failureReason = reason.slice(0, 500);
  await refund.save();

  await OrderModel.updateOne(
    { _id: refund.order },
    {
      $set: { 'refund.status': 'FAILED' },
      $push: {
        statusHistory: {
          status: 'REFUND_FAILED',
          timestamp: new Date(),
          note: `Refund failed: ${reason.slice(0, 200)}`,
        },
      },
    }
  );
  return refund;
}

/**
 * Refund a cancelled prepaid order to the customer's original instrument.
 * Safe to call more than once: an existing cancellation refund wins.
 */
export async function createCancellationRefund(
  order: {
    _id: unknown;
    user: unknown;
    total: number;
    razorpayPaymentId?: string;
  },
  reason = 'Order cancelled by the shop'
) {
  const existing = await RefundModel.findOne({ order: order._id, kind: 'CANCELLATION' });
  if (existing) return existing;

  const refund = await RefundModel.create({
    order: order._id,
    user: order.user,
    kind: 'CANCELLATION',
    reason,
    amount: order.total,
    method: 'RAZORPAY',
    razorpayPaymentId: order.razorpayPaymentId ?? '',
    status: 'PENDING',
  });

  try {
    const result = await refundRazorpayPayment({
      paymentId: order.razorpayPaymentId ?? '',
      amount: order.total,
      notes: { reason: 'cancelled_order', orderId: String(order._id) },
    });
    refund.razorpayRefundId = result.id;
    refund.status = result.status === 'processed' ? 'COMPLETED' : 'PENDING';
    if (refund.status === 'COMPLETED') refund.processedAt = new Date();
    await refund.save();
  } catch (error) {
    refund.failureReason = error instanceof Error ? error.message.slice(0, 500) : 'Refund failed';
    await refund.save();
    console.error('[refund] Late-capture refund failed for order', order._id, error);
  }

  await OrderModel.updateOne(
    { _id: order._id },
    {
      $set: {
        'refund.method': 'RAZORPAY',
        'refund.amount': order.total,
        'refund.status': refund.status,
        'refund.razorpayRefundId': refund.razorpayRefundId,
        'refund.refund': refund._id,
      },
      $push: {
        statusHistory: {
          status: 'CANCELLED',
          timestamp: new Date(),
          note: refund.status === 'COMPLETED'
            ? `Cancellation refund — ₹${order.total} returned to the original payment method`
            : `Cancellation refund ${refund.status.toLowerCase()}`,
        },
      },
    }
  );
  return refund;
}

/** A payment captured after cancellation must also be returned. */
export function refundLateCapture(order: {
  _id: unknown;
  user: unknown;
  total: number;
  razorpayPaymentId?: string;
}) {
  return createCancellationRefund(order, 'Payment captured after the order was cancelled');
}
