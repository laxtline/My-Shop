import type { Request, Response } from "express";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { ApiError } from "../utils/ApiError.js";

/** Where uploaded images are stored on disk (created on first use). */
export const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

/**
 * POST /api/uploads — admin only.
 * Body: { image: "data:image/png;base64,....." }.
 * Decodes the data URL, writes it to /uploads, and returns a public URL.
 */
export async function uploadImage(req: Request, res: Response) {
  const dataUrl = String(req.body?.image ?? "");
  const match = /^data:(image\/[a-zA-Z.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new ApiError(400, "Provide an image as a base64 data URL.");

  const mime = match[1].toLowerCase();
  const ext = EXT_BY_MIME[mime];
  if (!ext) throw new ApiError(400, "Unsupported image type. Use JPG, PNG, WEBP, GIF or AVIF.");

  const buffer = Buffer.from(match[2], "base64");
  // Guard size (~6MB) even though the route parser also caps the body.
  if (buffer.length > 6 * 1024 * 1024) throw new ApiError(413, "Image is too large (max 6MB).");

  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  const filename = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);

  // Absolute URL so the Next.js frontend can render it directly.
  const base = `${req.protocol}://${req.get("host")}`;
  res.status(201).json({
    success: true,
    data: { url: `${base}/uploads/${filename}` },
    message: "Image uploaded.",
  });
}
