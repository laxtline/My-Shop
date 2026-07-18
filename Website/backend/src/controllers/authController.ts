import type { Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import { UserModel } from "../models/User.js";
import { signToken, AUTH_COOKIE, AUTH_COOKIE_MAX_AGE } from "../utils/jwt.js";
import { ApiError } from "../utils/ApiError.js";
import { env, isProd } from "../config/env.js";

const googleClient = new OAuth2Client(env.googleClientId);

function setAuthCookie(res: Response, token: string): void {
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    maxAge: AUTH_COOKIE_MAX_AGE,
    path: "/",
  });
}

export function toPublicUser(user: InstanceType<typeof UserModel>) {
  return {
    id: user._id.toString(),
    googleId: user.googleId,
    email: user.email,
    name: user.name,
    picture: user.picture,
    role: user.role,
    addresses: (user.addresses ?? []).map((a) => ({
      id: a._id.toString(),
      fullName: a.fullName,
      phone: a.phone,
      line1: a.line1,
      line2: a.line2,
      city: a.city,
      state: a.state,
      pincode: a.pincode,
      isDefault: a.isDefault,
    })),
  };
}

/**
 * POST /api/auth/google
 * Body: { credential: <Google ID token from Google Sign-In> }
 * Verifies the token with Google, upserts the user, issues a JWT cookie.
 */
export async function googleLogin(req: Request, res: Response) {
  const credential = req.body?.credential;
  if (!credential || typeof credential !== "string") {
    throw new ApiError(400, "Missing Google credential.");
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: env.googleClientId,
    });
    payload = ticket.getPayload();
  } catch {
    throw new ApiError(401, "Google verification failed.");
  }

  if (!payload?.email || !payload.sub) {
    throw new ApiError(401, "Google account missing required fields.");
  }
  if (payload.email_verified === false) {
    throw new ApiError(401, "Google email is not verified.");
  }

  const email = payload.email.toLowerCase();
  let user = await UserModel.findOne({ googleId: payload.sub });

  if (!user) {
    // Fall back to email match (e.g. account created before googleId was stored).
    user = await UserModel.findOne({ email });
  }

  if (user) {
    user.googleId = payload.sub;
    user.email = email;
    user.name = payload.name ?? user.name;
    user.picture = payload.picture ?? user.picture;
    // role is re-derived in the pre-save hook
    await user.save();
  } else {
    user = await UserModel.create({
      googleId: payload.sub,
      email,
      name: payload.name ?? email,
      picture: payload.picture,
    });
  }

  const token = signToken({ userId: user._id.toString() });
  setAuthCookie(res, token);

  res.json({ success: true, data: { user: toPublicUser(user), token } });
}

/** GET /api/auth/me — returns the authenticated user. */
export async function getMe(req: Request, res: Response) {
  if (!req.user) throw new ApiError(401, "Not authenticated.");
  res.json({ success: true, data: { user: toPublicUser(req.user) } });
}

/** POST /api/auth/logout — clears the auth cookie. */
export async function logout(_req: Request, res: Response) {
  res.clearCookie(AUTH_COOKIE, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
  });
  res.json({ success: true, message: "Logged out." });
}
