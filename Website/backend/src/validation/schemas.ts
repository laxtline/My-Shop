import type { BodySchema } from "../utils/validate.js";

// --- Products ---------------------------------------------------------------
export const productCreateSchema: BodySchema = {
  title: { type: "string", required: true, min: 1, max: 200, label: "Title" },
  sku: { type: "string", required: true, min: 1, max: 100, label: "SKU" },
  category: { type: "string", required: true, label: "Category" },
  brand: { type: "string", max: 120, label: "Brand" },
  description: { type: "string", max: 5000, label: "Description" },
  price: { type: "number", required: true, min: 0, label: "Price" },
  mrp: { type: "number", required: true, min: 0, label: "MRP" },
  stock: { type: "integer", min: 0, label: "Stock" },
  gstRate: { type: "number", min: 0, max: 100, label: "GST rate" },
  weight: { type: "number", min: 0, label: "Weight" },
  isActive: { type: "boolean", label: "Active" },
  images: { type: "array", label: "Images" },
  tags: { type: "array", label: "Tags" },
  specifications: { type: "object", label: "Specifications" },
  bulkPricing: { type: "array", label: "Bulk pricing" },
};

// PUT updates: every field optional, but must be the right type when present.
export const productUpdateSchema: BodySchema = Object.fromEntries(
  Object.entries(productCreateSchema).map(([k, rule]) => [k, { ...rule, required: false }])
);

// --- Categories -------------------------------------------------------------
export const categoryCreateSchema: BodySchema = {
  name: { type: "string", required: true, min: 1, max: 120, label: "Name" },
  image: { type: "string", max: 1000, label: "Image" },
  order: { type: "number", label: "Order" },
  parentCategory: { type: "string", label: "Parent category" },
};

export const categoryUpdateSchema: BodySchema = {
  name: { type: "string", min: 1, max: 120, label: "Name" },
  image: { type: "string", max: 1000, label: "Image" },
  order: { type: "number", label: "Order" },
  parentCategory: { type: "string", label: "Parent category" },
};

// --- Orders -----------------------------------------------------------------
export const orderCreateSchema: BodySchema = {
  shippingAddress: { type: "object", required: true, label: "Shipping address" },
  paymentMethod: { type: "string", enum: ["COD", "RAZORPAY"], label: "Payment method" },
  couponCode: { type: "string", max: 40, label: "Coupon code" },
  notes: { type: "string", max: 500, label: "Notes" },
};

export const orderStatusSchema: BodySchema = {
  status: {
    type: "string",
    required: true,
    enum: ["PLACED", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"],
    label: "Status",
  },
};

// --- Reviews ----------------------------------------------------------------
export const reviewSchema: BodySchema = {
  productId: { type: "string", required: true, label: "Product" },
  rating: { type: "integer", required: true, min: 1, max: 5, label: "Rating" },
  comment: { type: "string", max: 1000, label: "Comment" },
};

// --- Payments ---------------------------------------------------------------
export const razorpayOrderSchema: BodySchema = {
  orderId: { type: "string", required: true, label: "Order id" },
};

export const razorpayVerifySchema: BodySchema = {
  orderId: { type: "string", required: true, label: "Order id" },
  razorpayPaymentId: { type: "string", required: true, label: "Payment id" },
  razorpayOrderId: { type: "string", required: true, label: "Razorpay order id" },
  razorpaySignature: { type: "string", required: true, label: "Signature" },
};

// --- Cart / Wishlist --------------------------------------------------------
export const cartAddSchema: BodySchema = {
  productId: { type: "string", required: true, label: "Product" },
  quantity: { type: "integer", min: 1, label: "Quantity" },
};

export const cartUpdateSchema: BodySchema = {
  productId: { type: "string", required: true, label: "Product" },
  quantity: { type: "number", required: true, label: "Quantity" },
};

export const wishlistAddSchema: BodySchema = {
  productId: { type: "string", required: true, label: "Product" },
};

// --- Coupons ----------------------------------------------------------------
export const couponValidateSchema: BodySchema = {
  code: { type: "string", required: true, min: 1, max: 40, label: "Coupon code" },
  itemsTotal: { type: "number", required: true, min: 1, label: "Cart total" },
};

export const couponCreateSchema: BodySchema = {
  code: { type: "string", required: true, min: 1, max: 40, label: "Coupon code" },
  type: { type: "string", enum: ["PERCENT", "FLAT"], label: "Type" },
  value: { type: "number", required: true, min: 0, label: "Value" },
  minOrder: { type: "number", min: 0, label: "Minimum order" },
  maxDiscount: { type: "number", min: 0, label: "Max discount" },
  isActive: { type: "boolean", label: "Active" },
  expiresAt: { type: "string", label: "Expiry date" },
};

// --- Addresses --------------------------------------------------------------
export const addressSchema: BodySchema = {
  fullName: { type: "string", required: true, min: 1, max: 100, label: "Full name" },
  phone: { type: "string", required: true, pattern: /^\d{10}$/, label: "Phone (10 digits)" },
  line1: { type: "string", required: true, min: 1, max: 200, label: "Address line 1" },
  line2: { type: "string", max: 200, label: "Address line 2" },
  city: { type: "string", required: true, max: 80, label: "City" },
  state: { type: "string", required: true, max: 80, label: "State" },
  pincode: { type: "string", required: true, pattern: /^\d{6}$/, label: "Pincode (6 digits)" },
  isDefault: { type: "boolean", label: "Default" },
};
