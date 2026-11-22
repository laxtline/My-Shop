// Shared API contracts and domain types used by Website, MobileApp and iOSApp.
// This is the single source of truth — do not redefine these in any app.

import type { CourierCode, ShipmentEvent, ShipmentStatus } from '../shipping';

export type Role = 'ADMIN' | 'USER';

export interface User {
  id: string;
  googleId: string;
  email: string;
  name: string;
  picture?: string;
  role: Role;
  addresses?: SavedAddress[];
  createdAt?: string;
  updatedAt?: string;
}

// A delivery address saved to the user's account (reusable at checkout).
export interface SavedAddress {
  id: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  isDefault?: boolean;
}

export interface BrandConfig {
  appName: string;
  tagline: string;
  logoUrl: string;
  supportPhone: string;
  supportEmail: string;
  themeColor: string;
  updatedAt?: string;
}

// Standard envelope every API endpoint returns.
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
}

// TODO: add request/response types for each endpoint
export interface AuthResponse {
  user: User;
  token: string;
}

// ---------------------------------------------------------------------------
// Catalog domain (Phase 1)
// ---------------------------------------------------------------------------

export interface Category {
  id: string;
  name: string;
  slug: string;
  image?: string;
  parentCategory?: string | null;
  order: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface BulkPriceTier {
  minQty: number;
  pricePerUnit: number;
}

export interface Product {
  id: string;
  title: string;
  slug: string;
  description: string;
  // Populated Category, or just its id when not populated.
  category: Category | string;
  brand: string;
  images: string[];
  price: number;
  mrp: number;
  discount: number; // percentage 0-100
  stock: number;
  sku: string;
  rating: number;
  numReviews: number;
  specifications: Record<string, string>;
  tags: string[];
  isActive: boolean;
  bulkPricing: BulkPriceTier[];
  gstRate: number;
  weight: number; // kg
  createdAt?: string;
  updatedAt?: string;
}

export interface CartItem {
  // Populated Product, or its id when not populated.
  product: Product | string;
  quantity: number;
}

export interface Cart {
  id: string;
  user: string;
  items: CartItem[];
  lastUpdatedAt?: string;
}

export interface Wishlist {
  id: string;
  user: string;
  items: Array<Product | string>;
}

// ---------------------------------------------------------------------------
// Reviews (Phase 4)
// ---------------------------------------------------------------------------

export interface Review {
  id: string;
  product: string; // product id
  user: string; // author user id
  userName: string; // snapshot of author name at write time
  userPicture?: string;
  rating: number; // 1-5
  comment: string;
  createdAt?: string;
  updatedAt?: string;
}

// ---------------------------------------------------------------------------
// Coupons (Phase 4)
// ---------------------------------------------------------------------------

export type CouponType = 'PERCENT' | 'FLAT';

export interface Coupon {
  id: string;
  code: string;
  description: string;
  type: CouponType;
  value: number; // percent (0-100) or flat rupees
  minOrder: number; // minimum items total to qualify
  maxDiscount: number; // cap for percent coupons; 0 = no cap
  minProductPrice: number;
  minItems: number;
  scope: 'ALL' | 'CATEGORIES' | 'PRODUCTS';
  categories: string[];
  products: string[];
  usageLimit: number; // 0 = unlimited
  perUserLimit: number; // 0 = unlimited
  startsAt?: string | null;
  totalUses: number;
  totalDiscount: number;
  isActive: boolean;
  expiresAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

// Result of validating a coupon against a cart total.
export interface CouponValidation {
  code: string;
  type: CouponType;
  value: number;
  discount: number; // computed discount amount in rupees
  itemsTotal: number;
  eligibleTotal: number;
  deliveryFee: number;
  total: number;
}

export type CouponView = 'active' | 'inactive' | 'expired' | 'scheduled';
export interface CouponList extends Paginated<Coupon> {
  counts: Record<CouponView, number>;
  nextTransitionAt?: string | null;
}
export interface CouponUsage {
  id: string;
  couponCode: string;
  customerName: string;
  customerEmail: string;
  order: string;
  discount: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Admin analytics (Phase 5)
// ---------------------------------------------------------------------------

export interface RevenuePoint {
  date: string; // YYYY-MM-DD
  revenue: number;
  orders: number;
}

export interface TopProduct {
  title: string;
  qty: number;
  revenue: number;
}

export interface OrderAnalytics {
  revenueByDay: RevenuePoint[];
  topProducts: TopProduct[];
  couponUsage: { code: string; uses: number; discount: number }[];
}

// Headline totals from GET /api/orders/admin/stats.
export interface OrderStats {
  totalOrders: number;
  revenue: number;
  sales: number;
  couponUses: number;
  discountGiven: number;
  // Order count keyed by OrderStatus; a status with no orders may be absent.
  statusCounts: Partial<Record<OrderStatus, number>>;
}

// Paginated list envelope returned by list endpoints.
export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  nextCursor?: string | null;
}

export type ProductSort =
  | 'newest'
  | 'price_asc'
  | 'price_desc'
  | 'rating'
  | 'discount';

// ---------------------------------------------------------------------------
// Orders / Checkout (Phase 3)
// ---------------------------------------------------------------------------

export type PaymentMethod = 'COD' | 'RAZORPAY';
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED';
/**
 * The instrument behind a payment. COD is its own channel; online payments are
 * captured through Razorpay as UPI, card, netbanking or wallet.
 */
export type PaymentChannel = 'COD' | 'UPI' | 'CARD' | 'NETBANKING' | 'WALLET' | 'UNKNOWN';

// Order lifecycle. Admin advances the status; users may cancel while PLACED/CONFIRMED.
export type OrderStatus =
  | 'PLACED'
  | 'CONFIRMED'
  | 'PACKED'
  | 'SHIPPED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

export interface ShippingAddress {
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
}

/** Customer-visible snapshot of the carrier shipment for an order. */
export interface ShipmentSummary {
  id: string;
  status: ShipmentStatus;
  provider: 'SHIPROCKET' | 'DELHIVERY' | 'MANUAL';
  courierCode: CourierCode | null;
  courierName: string;
  awb: string;
  trackingUrl: string;
  labelUrl?: string;
  estimatedDeliveryDate?: string | null;
  events: ShipmentEvent[];
  updatedAt?: string;
}

// A line item snapshot — title/price are frozen at order time for history integrity.
export interface OrderItem {
  product: string; // product id (may be null if later deleted)
  title: string;
  image: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface Order {
  id: string;
  user: string | User; // populated for admin views
  items: OrderItem[];
  shippingAddress: ShippingAddress;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentChannel?: PaymentChannel;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  paidAt?: string | null;
  /** Set when the delivery agent collects cash for a COD order. */
  codCollectedAt?: string | null;
  status: OrderStatus;
  itemsTotal: number;
  deliveryFee: number;
  couponCode?: string;
  discount?: number;
  total: number;
  notes?: string;
  // tracking & returns - TODO: split into separate types
  courierInfo?: {
    name: string;
    trackingId: string;
    trackingUrl: string;
  };
  /** Live carrier shipment attached to this order, when one was created. */
  shipment?: ShipmentSummary | null;
  expectedDeliveryDate?: string | null;
  statusHistory?: Array<{
    status: OrderStatus;
    timestamp: string;
    note: string;
  }>;
  returnRequest?: {
    requestedAt?: string;
    reason: string;
    pickupAddress?: ShippingAddress;
    status?: ReturnStatus;
    adminNotes?: string;
  };
  refund?: {
    method?: 'RAZORPAY' | 'UPI' | 'BANK';
    amount: number;
    status: 'PENDING' | 'COMPLETED' | 'FAILED';
    razorpayRefundId?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

// Return & Refund types
export type ReturnStatus =
  | 'REQUESTED'
  | 'APPROVED'
  | 'PICKUP_SCHEDULED'
  | 'PICKED_UP'
  | 'RECEIVED'
  | 'REFUND_INITIATED'
  | 'REFUNDED'
  | 'REJECTED';

export interface Return {
  id: string;
  order: string;
  user: string;
  items: Array<{
    product: string;
    title: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  reason: string;
  pickupAddress: ShippingAddress;
  status: ReturnStatus;
  courierName?: string;
  trackingId?: string;
  trackingUrl?: string;
  statusHistory: Array<{
    status: ReturnStatus;
    timestamp: string;
    note: string;
    updatedBy?: string;
  }>;
  adminNotes?: string;
  refundAmount?: number;
  refund?: string; // Refund ID
  createdAt?: string;
  updatedAt?: string;
}

export interface Refund {
  id: string;
  return?: string | null;
  order: string;
  user: string;
  kind?: 'RETURN' | 'CANCELLATION';
  reason?: string;
  amount: number;
  method: 'RAZORPAY' | 'UPI' | 'BANK';
  razorpayRefundId?: string;
  // Encrypted fields (not exposed to client)
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  processedAt?: string;
  processedBy?: string;
  adminNotes?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Tracking info for Track Order page
export interface OrderTracking {
  orderId: string;
  status: OrderStatus;
  statusHistory: Array<{
    status: OrderStatus;
    timestamp: string;
    note: string;
  }>;
  courier: {
    name: string;
    trackingId: string;
    trackingUrl: string;
  };
  trackingUrl?: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentChannel?: PaymentChannel;
  shipment?: ShipmentSummary | null;
  expectedDeliveryDate?: string | null;
  shippingAddress: ShippingAddress;
  items: OrderItem[];
  total: number;
  createdAt: string;
  returnRequest?: {
    requestedAt?: string;
    reason: string;
    pickupAddress?: ShippingAddress;
    status?: ReturnStatus;
    adminNotes?: string;
  };
  refund?: {
    method?: 'RAZORPAY' | 'UPI' | 'BANK';
    amount: number;
    status: 'PENDING' | 'COMPLETED' | 'FAILED';
  };
}

// ---------------------------------------------------------------------------
// Payments (Phase 4 — Razorpay)
// ---------------------------------------------------------------------------

// Public payment config the storefront reads to decide what to offer.
export interface PaymentConfig {
  razorpayEnabled: boolean;
  razorpayKeyId: string; // publishable key id (safe to expose); "" when disabled
  /** Online instruments enabled by the shop (always via Razorpay). */
  onlineMethods: PaymentChannel[];
  codEnabled: boolean;
  codFee: number;
  currency: 'INR';
  /** True when the shop can create hosted Razorpay payment links (mobile). */
  paymentLinksEnabled: boolean;
}

// Returned while polling a payment after a mobile/hosted checkout.
export interface PaymentStatusResult {
  orderId: string;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  paymentChannel?: PaymentChannel;
  paidAt?: string | null;
  total: number;
}

// Hosted Razorpay payment link (used by the mobile app, where the Checkout
// JavaScript SDK is not available).
export interface RazorpayPaymentLink {
  shortUrl: string;
  orderId: string;
  amount: number;
  currency: string;
  expiresAt?: string | null;
}

// Returned when a Razorpay order is created for one of our orders.
export interface RazorpayOrderInfo {
  keyId: string;
  razorpayOrderId: string;
  amount: number; // in paise
  currency: string;
  orderId: string; // our order id
  preferredMethod?: PaymentChannel;
  paymentStatus: PaymentStatus;
}

// ---------------------------------------------------------------------------
// Shipments / carrier integration (admin)
// ---------------------------------------------------------------------------

export interface AdminShipment {
  id: string;
  order: string;
  orderNumber?: string;
  provider: 'SHIPROCKET' | 'DELHIVERY' | 'MANUAL';
  providerOrderId: string;
  providerShipmentId: string;
  status: ShipmentStatus;
  courierCode: CourierCode | null;
  courierName: string;
  awb: string;
  trackingUrl: string;
  labelUrl: string;
  manifestUrl: string;
  weight: number;
  length: number;
  breadth: number;
  height: number;
  codAmount: number;
  charge: number;
  pickupScheduledAt?: string | null;
  estimatedDeliveryDate?: string | null;
  deliveredAt?: string | null;
  events: ShipmentEvent[];
  warnings?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateShipmentInput {
  /** Preferred courier. Omit to let the aggregator pick the cheapest option. */
  courierCode?: CourierCode;
  weight?: number;
  length?: number;
  breadth?: number;
  height?: number;
  pickupDate?: string;
  /** Ask the carrier to schedule a pickup immediately after AWB assignment. */
  schedulePickup?: boolean;
}

export interface AdminShipmentList {
  shipments: AdminShipment[];
  counts: Partial<Record<ShipmentStatus, number>>;
  total: number;
  page: number;
  totalPages: number;
}
