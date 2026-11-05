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
  updateCourierInfo,
  requestReturn,
  getReturnStatus,
  listReturns,
  updateReturnStatus,
  initiateRefund,
  completeRefund,
  listRefunds,
  getOrderTracking,
} from "../controllers/orderController.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { validateBody } from "../utils/validate.js";
import { orderCreateSchema, orderStatusSchema } from "../validation/schemas.js";
import { checkoutLimiter } from "../middleware/rateLimit.js";

const router = Router();

// Every order route requires a signed-in user.
router.use(requireAuth);

// Admin routes are registered before "/:id" so they are not shadowed by it.
router.get("/admin/all", requireAdmin, asyncHandler(listAllOrders));
router.get("/admin/stats", requireAdmin, asyncHandler(orderStats));
router.get("/admin/analytics", requireAdmin, asyncHandler(orderAnalytics));
router.patch("/:id/status", requireAdmin, validateBody(orderStatusSchema), asyncHandler(updateOrderStatus));

// Admin: courier tracking
router.put("/:id/courier", requireAdmin, asyncHandler(updateCourierInfo));

// Admin: returns
router.get("/admin/returns", requireAdmin, asyncHandler(listReturns));
router.put("/admin/returns/:id", requireAdmin, asyncHandler(updateReturnStatus));
router.post("/admin/returns/:id/refund", requireAdmin, asyncHandler(initiateRefund));

// Admin: refunds
router.get("/admin/refunds", requireAdmin, asyncHandler(listRefunds));
router.put("/admin/refunds/:id", requireAdmin, asyncHandler(completeRefund));

// User routes.
router.post("/", checkoutLimiter, validateBody(orderCreateSchema), asyncHandler(createOrder));
router.get("/", asyncHandler(listMyOrders));
router.get("/:id", asyncHandler(getOrder));
router.patch("/:id/cancel", asyncHandler(cancelOrder));

// User: returns
router.post("/:id/return", asyncHandler(requestReturn));
router.get("/:id/return", asyncHandler(getReturnStatus));

// User: tracking
router.get("/:id/track", asyncHandler(getOrderTracking));

export default router;
