import { Router } from "express";
import { googleLogin, getMe, logout } from "../controllers/authController.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/google", asyncHandler(googleLogin));
router.get("/me", requireAuth, asyncHandler(getMe));
router.post("/logout", asyncHandler(logout));

export default router;
