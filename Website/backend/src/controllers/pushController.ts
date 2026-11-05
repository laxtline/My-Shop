import type { Request, Response } from 'express';
import { UserModel } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * POST /api/push/token
 * Register or update the current user's push token.
 */
export async function registerPushToken(req: Request, res: Response) {
  const userId = req.user!._id;
  const { token } = req.body as { token?: string };

  if (!token || typeof token !== 'string' || token.length < 10) {
    throw new ApiError(400, 'Valid Expo push token is required.');
  }

  await UserModel.updateOne({ _id: userId }, { pushToken: token });
  res.json({ success: true, message: 'Push token registered.' });
}

/**
 * DELETE /api/push/token
 * Remove the current user's push token (logout).
 */
export async function removePushToken(req: Request, res: Response) {
  const userId = req.user!._id;
  await UserModel.updateOne({ _id: userId }, { pushToken: '' });
  res.json({ success: true, message: 'Push token removed.' });
}

/**
 * GET /api/push/token
 * Check if current user has a push token registered.
 */
export async function getPushTokenStatus(req: Request, res: Response) {
  const user = await UserModel.findById(req.user!._id).select('pushToken');
  res.json({ success: true, data: { hasToken: !!user?.pushToken } });
}