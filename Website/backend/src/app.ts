import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { UPLOADS_DIR } from "./controllers/uploadController.js";
import { allowedOrigins } from "./config/env.js";
import { ApiError } from "./utils/ApiError.js";
import { errorHandler, notFound } from "./middleware/error.js";
import brandRoutes from "./routes/brand.routes.js";
import authRoutes from "./routes/auth.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import productRoutes from "./routes/product.routes.js";
import cartRoutes from "./routes/cart.routes.js";
import wishlistRoutes from "./routes/wishlist.routes.js";
import searchRoutes from "./routes/search.routes.js";
import orderRoutes from "./routes/order.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import reviewRoutes from "./routes/review.routes.js";
import addressRoutes from "./routes/address.routes.js";
import couponRoutes from "./routes/coupon.routes.js";
import uploadRoutes from "./routes/upload.routes.js";

export function createApp() {
  const app = express();

  // Behind a proxy (e.g. on a host) so rate-limit / secure cookies see real IPs.
  app.set("trust proxy", 1);

  // Allow uploaded images to be embedded by the frontend (different origin).
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      // Reflect the request origin when it is on the allow-list. Server-to-server
      // and same-origin callers send no Origin header at all — allow those too,
      // since CORS is a browser-side control and has nothing to protect there.
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin.replace(/\/$/, ""))) {
          return callback(null, true);
        }
        // Throw an ApiError, not a bare Error: a disallowed origin is a client
        // problem (403), and a bare Error reaches the handler as a 500 — which
        // logs every blocked request as a server crash and tells the caller the
        // server is broken when it is working exactly as configured.
        callback(new ApiError(403, "Origin not allowed by CORS."));
      },
      credentials: true,
    })
  );

  app.use(cookieParser());

  // Serve uploaded product images statically from /uploads.
  app.use("/uploads", express.static(UPLOADS_DIR));

  // Image uploads carry base64 payloads, so this route needs a larger JSON cap
  // than the global 1mb limit below. Mounted before the global parser.
  app.use("/api/uploads", express.json({ limit: "8mb" }), uploadRoutes);

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Global rate limiter — 300 requests / 15 min / IP.
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 300,
      standardHeaders: true,
      legacyHeaders: false,
      message: { success: false, message: "Too many requests, please try again later." },
    })
  );

  // Stricter limiter for the credential-exchange endpoint only — a common abuse
  // target. 20 attempts / 15 min / IP, layered on top of the global limiter.
  //
  // Scoped to POST /api/auth/google deliberately. Mounting it on the whole
  // /api/auth router also throttled GET /api/auth/me, which every page load
  // calls to restore the session: ~20 page views burned the quota and the next
  // real sign-in was rejected with "Too many login attempts".
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many login attempts, please try again later." },
  });

  app.get("/api/health", (_req, res) => {
    res.json({ success: true, data: { status: "ok", uptime: process.uptime() } });
  });

  app.use("/api/brand", brandRoutes);
  app.use("/api/auth/google", loginLimiter);
  app.use("/api/auth", authRoutes);
  app.use("/api/categories", categoryRoutes);
  app.use("/api/products", productRoutes);
  app.use("/api/cart", cartRoutes);
  app.use("/api/wishlist", wishlistRoutes);
  app.use("/api/search", searchRoutes);
  app.use("/api/orders", orderRoutes);
  app.use("/api/payments", paymentRoutes);
  app.use("/api/reviews", reviewRoutes);
  app.use("/api/addresses", addressRoutes);
  app.use("/api/coupons", couponRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
