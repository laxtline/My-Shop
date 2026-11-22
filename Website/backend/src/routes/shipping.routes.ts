import { Router } from 'express';
import {
  cancelShipment,
  createShipment,
  delhiveryWebhook,
  downloadLabel,
  getOrderShipment,
  getServiceability,
  getSettings,
  getShipment,
  getShippingConfig,
  listCouriers,
  listShipments,
  putSettings,
  quoteOrder,
  schedulePickup,
  shiprocketWebhook,
  syncShipmentHandler,
} from '../controllers/shippingController.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { validateBody } from '../utils/validate.js';
import { shipmentCreateSchema, shippingSettingsSchema } from '../validation/schemas.js';

const router = Router();

// Public storefront endpoints.
router.get('/config', asyncHandler(getShippingConfig));
router.get('/serviceability', asyncHandler(getServiceability));
router.get('/couriers', listCouriers);

// Customer polling for a live shipment.
router.get('/orders/:orderId/shipment', requireAuth, asyncHandler(getOrderShipment));

// Provider callbacks. Authentication is a shared token, never a user session.
router.post('/webhook/shiprocket', asyncHandler(shiprocketWebhook));
router.post('/webhook/delhivery', asyncHandler(delhiveryWebhook));

// Admin — settings.
router.get('/admin/settings', requireAuth, requireAdmin, asyncHandler(getSettings));
router.put('/admin/settings', requireAuth, requireAdmin, validateBody(shippingSettingsSchema), asyncHandler(putSettings));

// Admin — shipment operations.
router.get('/admin/shipments', requireAuth, requireAdmin, asyncHandler(listShipments));
router.get('/admin/shipments/:id', requireAuth, requireAdmin, asyncHandler(getShipment));
router.get('/admin/shipments/:id/label', requireAuth, requireAdmin, asyncHandler(downloadLabel));
router.post('/admin/shipments/:id/sync', requireAuth, requireAdmin, asyncHandler(syncShipmentHandler));
router.post('/admin/shipments/:id/pickup', requireAuth, requireAdmin, asyncHandler(schedulePickup));
router.post('/admin/shipments/:id/cancel', requireAuth, requireAdmin, asyncHandler(cancelShipment));
router.get('/admin/orders/:orderId/quote', requireAuth, requireAdmin, asyncHandler(quoteOrder));
router.post(
  '/admin/orders/:orderId/shipment',
  requireAuth,
  requireAdmin,
  validateBody(shipmentCreateSchema),
  asyncHandler(createShipment)
);

export default router;
