import { Router } from "express";
import {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  mergeCart,
} from "../controllers/cartController.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { validateBody } from "../utils/validate.js";
import { cartAddSchema, cartUpdateSchema } from "../validation/schemas.js";

const router = Router();

// All cart operations require a logged-in user.
router.use(requireAuth);

router.get("/", asyncHandler(getCart));
router.post('/merge', asyncHandler(mergeCart));
router.post("/add", validateBody(cartAddSchema), asyncHandler(addToCart));
router.put("/update", validateBody(cartUpdateSchema), asyncHandler(updateCartItem));
router.delete("/remove/:id", asyncHandler(removeFromCart));

export default router;
