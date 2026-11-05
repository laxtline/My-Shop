// Shared API contracts and domain types used by Website, AndroidApp and iOSApp.
// This is the single source of truth — do not redefine these in any app.

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
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
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
    method?: 'UPI' | 'BANK';
    amount: number;
    status: 'PENDING' | 'COMPLETED' | 'FAILED';
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
  return: string;
  order: string;
  user: string;
  amount: number;
  method: 'UPI' | 'BANK';
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
    method?: 'UPI' | 'BANK';
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
}

// Returned when a Razorpay order is created for one of our orders.
export interface RazorpayOrderInfo {
  keyId: string;
  razorpayOrderId: string;
  amount: number; // in paise
  currency: string;
  orderId: string; // our order id
}
