import type { NextFunction, Request, Response } from "express";
import { verifyToken, AUTH_COOKIE } from "../utils/jwt.js";
import { UserModel } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Augment Express Request with the authenticated user.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: InstanceType<typeof UserModel>;
    }
  }
}

function extractToken(req: Request): string | null {
  const cookieToken = req.cookies?.[AUTH_COOKIE];
  if (cookieToken) return cookieToken;

  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);

  return null;
}

/** Requires a valid JWT; loads the user onto req.user. */
export const requireAuth = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const token = extractToken(req);
    if (!token) throw new ApiError(401, "Authentication required.");

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      throw new ApiError(401, "Invalid or expired session.");
    }

    const user = await UserModel.findById(payload.userId);
    if (!user) throw new ApiError(401, "User no longer exists.");

    req.user = user;
    next();
  }
);

/** Requires the authenticated user to be an ADMIN. Use after requireAuth. */
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (req.user?.role !== "ADMIN") {
    throw new ApiError(403, "Admin access required.");
  }
  next();
}
