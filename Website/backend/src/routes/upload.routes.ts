import { Router } from "express";
import { uploadImage } from "../controllers/uploadController.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

// Larger JSON body limit here (base64 images) than the global 1mb cap.
router.post("/", requireAuth, requireAdmin, asyncHandler(uploadImage));

export default router;
