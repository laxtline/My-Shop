import { Router } from "express";
import {
  createOrder,
  listMyOrders,
  getOrder,
  cancelOrder,
  listAllOrders,
  updateOrderStatus,
  orderStats,
  orderAnalytics,
} from "../controllers/orderController.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { validateBody } from "../utils/validate.js";
import { orderCreateSchema, orderStatusSchema } from "../validation/schemas.js";

const router = Router();

// Every order route requires a signed-in user.
router.use(requireAuth);

// Admin routes are registered before "/:id" so they are not shadowed by it.
router.get("/admin/all", requireAdmin, asyncHandler(listAllOrders));
router.get("/admin/stats", requireAdmin, asyncHandler(orderStats));
router.get("/admin/analytics", requireAdmin, asyncHandler(orderAnalytics));
router.patch("/:id/status", requireAdmin, validateBody(orderStatusSchema), asyncHandler(updateOrderStatus));

// User routes.
router.post("/", validateBody(orderCreateSchema), asyncHandler(createOrder));
router.get("/", asyncHandler(listMyOrders));
router.get("/:id", asyncHandler(getOrder));
router.patch("/:id/cancel", asyncHandler(cancelOrder));

export default router;
