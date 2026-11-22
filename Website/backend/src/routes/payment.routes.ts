import { Router } from "express";
import {
  getPaymentConfig,
  createRazorpayOrder,
  verifyRazorpayPayment,
  createRazorpayPaymentLink,
  getPaymentStatus,
  razorpayWebhook,
} from "../controllers/paymentController.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { validateBody } from "../utils/validate.js";
import { razorpayOrderSchema, razorpayVerifySchema } from "../validation/schemas.js";

const router = Router();

router.get("/config", asyncHandler(getPaymentConfig));
router.post("/razorpay/order", requireAuth, validateBody(razorpayOrderSchema), asyncHandler(createRazorpayOrder));
router.post("/razorpay/verify", requireAuth, validateBody(razorpayVerifySchema), asyncHandler(verifyRazorpayPayment));
// Hosted payment link for the mobile app (no Checkout.js there).
router.post("/razorpay/link", requireAuth, validateBody(razorpayOrderSchema), asyncHandler(createRazorpayPaymentLink));
// Polled by the app after the browser hand-off; also reconciles webhooks.
router.get("/status/:orderId", requireAuth, asyncHandler(getPaymentStatus));
// Webhook endpoint - NO auth required, verified via signature
router.post("/razorpay/webhook", asyncHandler(razorpayWebhook));

export default router;
