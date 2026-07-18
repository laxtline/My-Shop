import { Router } from "express";
import { getBrand, updateBrand } from "../controllers/brandController.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

router.get("/", asyncHandler(getBrand));
router.put("/", requireAuth, requireAdmin, asyncHandler(updateBrand));

export default router;
