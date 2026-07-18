import { Router } from "express";
import {
  getPaymentConfig,
  createRazorpayOrder,
  verifyRazorpayPayment,
} from "../controllers/paymentController.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { validateBody } from "../utils/validate.js";
import { razorpayOrderSchema, razorpayVerifySchema } from "../validation/schemas.js";

const router = Router();

router.get("/config", asyncHandler(getPaymentConfig));
router.post("/razorpay/order", requireAuth, validateBody(razorpayOrderSchema), asyncHandler(createRazorpayOrder));
router.post("/razorpay/verify", requireAuth, validateBody(razorpayVerifySchema), asyncHandler(verifyRazorpayPayment));

export default router;
