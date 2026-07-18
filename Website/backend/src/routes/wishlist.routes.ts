import { Router } from "express";
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
} from "../controllers/wishlistController.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { validateBody } from "../utils/validate.js";
import { wishlistAddSchema } from "../validation/schemas.js";

const router = Router();

router.use(requireAuth);

router.get("/", asyncHandler(getWishlist));
router.post("/add", validateBody(wishlistAddSchema), asyncHandler(addToWishlist));
router.delete("/remove/:id", asyncHandler(removeFromWishlist));

export default router;
