import type { BodySchema } from '../utils/validate.js';

// --- Products ---------------------------------------------------------------
export const productCreateSchema: BodySchema = {
  title: { type: 'string', required: true, min: 1, max: 200, label: 'Title' },
  sku: { type: 'string', required: true, min: 1, max: 100, label: 'SKU' },
  category: { type: 'string', required: true, label: 'Category' },
  brand: { type: 'string', max: 120, label: 'Brand' },
  description: { type: 'string', max: 5000, label: 'Description' },
  price: { type: 'number', required: true, min: 0, label: 'Price' },
  mrp: { type: 'number', required: true, min: 0, label: 'MRP' },
  stock: { type: 'integer', min: 0, label: 'Stock' },
  gstRate: { type: 'number', min: 0, max: 100, label: 'GST rate' },
  weight: { type: 'number', min: 0, label: 'Weight' },
  isActive: { type: 'boolean', label: 'Active' },
  images: { type: 'array', label: 'Images' },
  tags: { type: 'array', label: 'Tags' },
  specifications: { type: 'object', label: 'Specifications' },
  bulkPricing: { type: 'array', label: 'Bulk pricing' },
};

// PUT updates: every field optional, but must be the right type when present.
export const productUpdateSchema: BodySchema = Object.fromEntries(
  Object.entries(productCreateSchema).map(([k, rule]) => [k, { ...rule, required: false }])
);

// --- Categories -------------------------------------------------------------
export const categoryCreateSchema: BodySchema = {
  name: { type: 'string', required: true, min: 1, max: 120, label: 'Name' },
  image: { type: 'string', max: 1000, label: 'Image' },
  order: { type: 'number', label: 'Order' },
  parentCategory: { type: 'string', label: 'Parent category' },
};

export const categoryUpdateSchema: BodySchema = {
  name: { type: 'string', min: 1, max: 120, label: 'Name' },
  image: { type: 'string', max: 1000, label: 'Image' },
  order: { type: 'number', label: 'Order' },
  parentCategory: { type: 'string', label: 'Parent category' },
};

// --- Orders -----------------------------------------------------------------
export const orderCreateSchema: BodySchema = {
  shippingAddress: { type: 'object', required: true, label: 'Shipping address' },
  paymentMethod: { type: 'string', enum: ['COD', 'RAZORPAY'], label: 'Payment method' },
  paymentChannel: { type: 'string', enum: ['COD', 'UPI', 'CARD', 'NETBANKING', 'WALLET'], label: 'Payment channel' },
  couponCode: { type: 'string', max: 40, label: 'Coupon code' },
  notes: { type: 'string', max: 500, label: 'Notes' },
};

export const orderStatusSchema: BodySchema = {
  status: {
    type: 'string',
    required: true,
    enum: ['PLACED', 'CONFIRMED', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
    label: 'Status',
  },
};

// --- Reviews ----------------------------------------------------------------
export const reviewSchema: BodySchema = {
  productId: { type: 'string', required: true, label: 'Product' },
  rating: { type: 'integer', required: true, min: 1, max: 5, label: 'Rating' },
  comment: { type: 'string', max: 1000, label: 'Comment' },
};

// --- Payments ---------------------------------------------------------------
export const razorpayOrderSchema: BodySchema = {
  orderId: { type: 'string', required: true, label: 'Order id' },
  preferredMethod: { type: 'string', enum: ['UPI', 'CARD', 'NETBANKING', 'WALLET'], label: 'Preferred method' },
};

export const razorpayVerifySchema: BodySchema = {
  orderId: { type: 'string', required: true, label: 'Order id' },
  razorpayPaymentId: { type: 'string', required: true, label: 'Payment id' },
  razorpayOrderId: { type: 'string', required: true, label: 'Razorpay order id' },
  razorpaySignature: { type: 'string', required: true, label: 'Signature' },
};

// --- Shipping ---------------------------------------------------------------
export const shipmentCreateSchema: BodySchema = {
  courierCode: {
    type: 'string',
    enum: ['SHIPROCKET', 'DELHIVERY', 'EKART', 'BLUEDART', 'DTDC', 'XPRESSBEES', 'SHADOWFAX', 'INDIA_POST'],
    label: 'Courier',
  },
  weight: { type: 'number', min: 0.1, max: 500, label: 'Weight (kg)' },
  length: { type: 'number', min: 1, max: 500, label: 'Length (cm)' },
  breadth: { type: 'number', min: 1, max: 500, label: 'Breadth (cm)' },
  height: { type: 'number', min: 1, max: 500, label: 'Height (cm)' },
  pickupDate: { type: 'string', max: 40, label: 'Pickup date' },
  schedulePickup: { type: 'boolean', label: 'Schedule pickup' },
};

export const shippingSettingsSchema: BodySchema = {
  originPincode: { type: 'string', pattern: /^[1-9]\d{5}$/, label: 'Origin pincode' },
  originCity: { type: 'string', max: 80, label: 'Origin city' },
  originState: { type: 'string', max: 80, label: 'Origin state' },
  pickupLocationName: { type: 'string', max: 120, label: 'Pickup location' },
  contactName: { type: 'string', max: 120, label: 'Contact name' },
  contactPhone: { type: 'string', pattern: /^[6-9]\d{9}$/, label: 'Contact phone' },
  addressLine1: { type: 'string', max: 200, label: 'Address line 1' },
  addressLine2: { type: 'string', max: 200, label: 'Address line 2' },
  baseDeliveryFee: { type: 'number', min: 0, max: 10000, label: 'Base delivery fee' },
  freeDeliveryOver: { type: 'number', min: 0, max: 1000000, label: 'Free delivery threshold' },
  codEnabled: { type: 'boolean', label: 'COD enabled' },
  codFee: { type: 'number', min: 0, max: 5000, label: 'COD fee' },
  serviceablePincodes: { type: 'array', max: 500, label: 'Serviceable pincodes' },
  noCodPincodes: { type: 'array', max: 500, label: 'No-COD pincodes' },
  localDaysMin: { type: 'integer', min: 0, max: 30, label: 'Local ETA min' },
  localDaysMax: { type: 'integer', min: 0, max: 30, label: 'Local ETA max' },
  regionalDaysMin: { type: 'integer', min: 0, max: 30, label: 'Regional ETA min' },
  regionalDaysMax: { type: 'integer', min: 0, max: 30, label: 'Regional ETA max' },
  nationalDaysMin: { type: 'integer', min: 0, max: 45, label: 'National ETA min' },
  nationalDaysMax: { type: 'integer', min: 0, max: 45, label: 'National ETA max' },
};

// --- Cart / Wishlist --------------------------------------------------------
export const cartAddSchema: BodySchema = {
  productId: { type: 'string', required: true, label: 'Product' },
  quantity: { type: 'integer', min: 1, label: 'Quantity' },
};

export const cartUpdateSchema: BodySchema = {
  productId: { type: 'string', required: true, label: 'Product' },
  quantity: { type: 'integer', required: true, min: 1, label: 'Quantity' },
};

export const wishlistAddSchema: BodySchema = {
  productId: { type: 'string', required: true, label: 'Product' },
};

// --- Coupons ----------------------------------------------------------------
export const couponValidateSchema: BodySchema = {
  code: { type: 'string', required: true, min: 1, max: 40, label: 'Coupon code' },
};

export const couponCreateSchema: BodySchema = {
  code: { type: 'string', required: true, min: 1, max: 40, label: 'Coupon code' },
  description: { type: 'string', max: 1000, label: 'Description' },
  type: { type: 'string', enum: ['PERCENT', 'FLAT'], label: 'Type' },
  value: { type: 'number', required: true, min: 0, label: 'Value' },
  minOrder: { type: 'number', min: 0, label: 'Minimum order' },
  maxDiscount: { type: 'number', min: 0, label: 'Max discount' },
  minProductPrice: { type: 'number', min: 0, label: 'Minimum product price' },
  minItems: { type: 'integer', min: 0, label: 'Minimum items' },
  scope: { type: 'string', enum: ['ALL', 'CATEGORIES', 'PRODUCTS'], label: 'Scope' },
  categories: { type: 'array', max: 200, label: 'Categories' },
  products: { type: 'array', max: 200, label: 'Products' },
  usageLimit: { type: 'integer', min: 0, label: 'Total usage limit' },
  perUserLimit: { type: 'integer', min: 0, label: 'Per-user limit' },
  startsAt: { type: 'string', label: 'Start date' },
  isActive: { type: 'boolean', label: 'Active' },
  expiresAt: { type: 'string', label: 'Expiry date' },
};

// --- Addresses --------------------------------------------------------------
export const addressSchema: BodySchema = {
  fullName: { type: 'string', required: true, min: 1, max: 100, label: 'Full name' },
  phone: { type: 'string', required: true, pattern: /^\d{10}$/, label: 'Phone (10 digits)' },
  line1: { type: 'string', required: true, min: 1, max: 200, label: 'Address line 1' },
  line2: { type: 'string', max: 200, label: 'Address line 2' },
  city: { type: 'string', required: true, max: 80, label: 'City' },
  state: { type: 'string', required: true, max: 80, label: 'State' },
  pincode: { type: 'string', required: true, pattern: /^\d{6}$/, label: 'Pincode (6 digits)' },
  isDefault: { type: 'boolean', label: 'Default' },
};
