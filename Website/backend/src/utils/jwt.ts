import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";

export interface JwtPayload {
  userId: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"],
  });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwtSecret) as JwtPayload;
}

export const AUTH_COOKIE = "rt_token";

/** 7 days in ms — keep in sync with JWT_EXPIRES_IN default. */
export const AUTH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
