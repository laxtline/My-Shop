import { Router } from 'express';
import { registerPushToken, removePushToken, getPushTokenStatus } from '../controllers/pushController.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/token', requireAuth, asyncHandler(getPushTokenStatus));
router.post('/token', requireAuth, asyncHandler(registerPushToken));
router.delete('/token', requireAuth, asyncHandler(removePushToken));

export default router;