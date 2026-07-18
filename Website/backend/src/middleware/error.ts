import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError.js";
import { isProd } from "../config/env.js";

/** 404 handler for unmatched routes. */
export function notFound(req: Request, res: Response): void {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
}

/** Centralized error handler. Must be registered last. */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  let statusCode = 500;
  let message = err instanceof Error ? err.message : "Internal Server Error";

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
  } else if (err && typeof err === "object") {
    const e = err as { name?: string; type?: string; status?: number };
    if (e.name === "CastError") {
      // Invalid MongoDB ObjectId in a param/body — client error, not a crash.
      statusCode = 400;
      message = "Invalid id format.";
    } else if (e.type === "entity.parse.failed" || e.type === "entity.too.large") {
      // Malformed or oversized JSON body from body-parser.
      statusCode = typeof e.status === "number" ? e.status : 400;
      message = e.type === "entity.too.large" ? "Request body too large." : "Invalid JSON body.";
    } else if (e.name === "ValidationError") {
      // Mongoose schema validation failure.
      statusCode = 400;
    }
  }

  if (statusCode >= 500) {
    console.error("[error]", err);
    // Never leak internal error details (DB messages, stack hints) in production.
    if (isProd) message = "Internal Server Error";
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(isProd ? {} : { stack: err instanceof Error ? err.stack : undefined }),
  });
}
