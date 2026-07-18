import type { Request, Response } from "express";
import { getOrCreateBrand, BrandConfigModel } from "../models/BrandConfig.js";

const EDITABLE_FIELDS = [
  "appName",
  "tagline",
  "logoUrl",
  "supportPhone",
  "supportEmail",
  "themeColor",
] as const;

/** GET /api/brand — public. Returns live branding (seeded on first access). */
export async function getBrand(_req: Request, res: Response) {
  const brand = await getOrCreateBrand();
  res.json({ success: true, data: brand });
}

/** PUT /api/brand — admin only. Updates editable branding fields. */
export async function updateBrand(req: Request, res: Response) {
  const brand = await getOrCreateBrand();

  for (const field of EDITABLE_FIELDS) {
    if (typeof req.body?.[field] === "string" && req.body[field].trim() !== "") {
      brand.set(field, req.body[field].trim());
    }
  }

  await brand.save();
  res.json({ success: true, data: brand, message: "Branding updated." });
}

// Re-export for potential reuse/testing.
export { BrandConfigModel };
