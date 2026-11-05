import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/ApiError.js';

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
  message?: string;
}

const stores = new Map<string, Map<string, { count: number; resetAt: number }>>();

function getStore(keyPrefix: string): Map<string, { count: number; resetAt: number }> {
  if (!stores.has(keyPrefix)) {
    stores.set(keyPrefix, new Map());
  }
  return stores.get(keyPrefix)!;
}

function cleanupStore(keyPrefix: string): void {
  const store = getStore(keyPrefix);
  const now = Date.now();
  for (const [key, value] of store.entries()) {
    if (value.resetAt < now) {
      store.delete(key);
    }
  }
}

export function rateLimit(options: RateLimitOptions) {
  const { windowMs, maxRequests, keyPrefix, message = "Too many requests, please try again later." } = options;

  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const store = getStore(keyPrefix);
      cleanupStore(keyPrefix);

      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      const key = `${keyPrefix}:${ip}`;

      const now = Date.now();
      const existing = store.get(key);

      if (!existing || existing.resetAt < now) {
        store.set(key, { count: 1, resetAt: now + windowMs });
        return next();
      }

      if (existing.count >= maxRequests) {
        throw new ApiError(429, message);
      }

      existing.count += 1;
      next();
    } catch (err) {
      next(err);
    }
  };
}

// Pre-configured rate limiters
export const couponValidateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 requests per minute
  keyPrefix: 'coupon-validate',
  message: 'Too many coupon validation attempts. Please wait a moment before trying again.',
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 20, // 20 requests per 15 minutes
  keyPrefix: 'auth',
  message: 'Too many authentication attempts. Please try again later.',
});

export const checkoutLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 5, // 5 orders per minute
  keyPrefix: 'checkout',
  message: 'Too many checkout attempts. Please wait before placing another order.',
});