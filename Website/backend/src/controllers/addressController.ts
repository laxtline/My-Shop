import type { Request, Response } from "express";
import { ApiError } from "../utils/ApiError.js";
import { toPublicUser } from "./authController.js";

/** Normalise an incoming address body into the stored shape. */
function pickAddress(body: Record<string, unknown>) {
  return {
    fullName: String(body.fullName ?? "").trim(),
    phone: String(body.phone ?? "").trim(),
    line1: String(body.line1 ?? "").trim(),
    line2: String(body.line2 ?? "").trim(),
    city: String(body.city ?? "").trim(),
    state: String(body.state ?? "").trim(),
    pincode: String(body.pincode ?? "").trim(),
    isDefault: Boolean(body.isDefault),
  };
}

/** GET /api/addresses — auth. The user's saved addresses. */
export async function listAddresses(req: Request, res: Response) {
  res.json({ success: true, data: toPublicUser(req.user!).addresses });
}

/** POST /api/addresses — auth. Add a new saved address. */
export async function addAddress(req: Request, res: Response) {
  const user = req.user!;
  const addr = pickAddress(req.body ?? {});

  // First address is always the default; an explicit default clears the others.
  if (user.addresses.length === 0) addr.isDefault = true;
  if (addr.isDefault) user.addresses.forEach((a) => (a.isDefault = false));

  user.addresses.push(addr);
  await user.save();

  res.status(201).json({ success: true, data: toPublicUser(user), message: "Address added." });
}

/** PUT /api/addresses/:id — auth. Update an existing address. */
export async function updateAddress(req: Request, res: Response) {
  const user = req.user!;
  const found = user.addresses.find((a) => a._id.toString() === req.params.id);
  if (!found) throw new ApiError(404, "Address not found.");

  const data = pickAddress(req.body ?? {});
  if (data.isDefault) user.addresses.forEach((a) => (a.isDefault = false));

  found.fullName = data.fullName;
  found.phone = data.phone;
  found.line1 = data.line1;
  found.line2 = data.line2;
  found.city = data.city;
  found.state = data.state;
  found.pincode = data.pincode;
  found.isDefault = data.isDefault;

  await user.save();
  res.json({ success: true, data: toPublicUser(user), message: "Address updated." });
}

/** DELETE /api/addresses/:id — auth. Remove an address. */
export async function deleteAddress(req: Request, res: Response) {
  const user = req.user!;
  const target = user.addresses.find((a) => a._id.toString() === req.params.id);
  if (!target) throw new ApiError(404, "Address not found.");
  const wasDefault = target.isDefault;

  user.set(
    "addresses",
    user.addresses.filter((a) => a._id.toString() !== req.params.id)
  );
  // Keep a default if we removed the default one.
  if (wasDefault && user.addresses.length > 0) user.addresses[0].isDefault = true;

  await user.save();
  res.json({ success: true, data: toPublicUser(user), message: "Address removed." });
}
