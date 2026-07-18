import { connectDB, disconnectDB } from "../config/db.js";
import { BrandConfigModel } from "../models/BrandConfig.js";
import { DEFAULT_BRAND } from "@shared/constants/index.js";

/** Idempotent: creates the brand config if missing, otherwise leaves it as-is. */
async function seedBrand() {
  await connectDB();

  const existing = await BrandConfigModel.findOne();
  if (existing) {
    console.log("[seed] brandConfig already exists — leaving it unchanged:");
    console.log(`        appName="${existing.appName}", phone=${existing.supportPhone}`);
  } else {
    const created = await BrandConfigModel.create({ ...DEFAULT_BRAND });
    console.log("[seed] brandConfig created with defaults:");
    console.log(`        appName="${created.appName}", phone=${created.supportPhone}`);
  }

  await disconnectDB();
  process.exit(0);
}

seedBrand().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
