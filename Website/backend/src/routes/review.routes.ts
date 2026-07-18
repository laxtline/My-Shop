import { Router } from "express";
import {
  listProductReviews,
  upsertReview,
  deleteReview,
} from "../controllers/reviewController.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { validateBody } from "../utils/validate.js";
import { reviewSchema } from "../validation/schemas.js";

const router = Router();

router.get("/product/:productId", asyncHandler(listProductReviews));
router.post("/", requireAuth, validateBody(reviewSchema), asyncHandler(upsertReview));
router.delete("/:id", requireAuth, asyncHandler(deleteReview));

export default router;
