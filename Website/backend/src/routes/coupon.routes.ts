import { Router } from "express";
import {
  validateCoupon,
  listCoupons,
  createCoupon,
  deleteCoupon,
} from "../controllers/couponController.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { validateBody } from "../utils/validate.js";
import { couponValidateSchema, couponCreateSchema } from "../validation/schemas.js";

const router = Router();

// Any signed-in user can check a coupon at checkout.
router.post("/validate", requireAuth, validateBody(couponValidateSchema), asyncHandler(validateCoupon));

// Admin management.
router.get("/", requireAuth, requireAdmin, asyncHandler(listCoupons));
router.post("/", requireAuth, requireAdmin, validateBody(couponCreateSchema), asyncHandler(createCoupon));
router.delete("/:id", requireAuth, requireAdmin, asyncHandler(deleteCoupon));

export default router;
