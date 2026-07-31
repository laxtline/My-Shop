import { connectDB, disconnectDB } from "../config/db.js";
import { BrandConfigModel } from "../models/BrandConfig.js";
import { DEFAULT_BRAND } from "@shared/constants/index.js";

/**
 * Idempotent: creates the brand config if missing.
 *
 * An existing document is left alone EXCEPT for the support contact fields.
 * Those are read off DEFAULT_BRAND (shared/constants) and reconciled on every
 * run, because the storefront footer, invoices and the WhatsApp/Call buttons all
 * render the stored value — so changing the constant alone left the old number
 * live on the site with no way to correct it short of editing the database by
 * hand. appName / tagline / logo / theme stay untouched: those are the operator's
 * to edit, and re-seeding must not clobber them.
 */
async function seedBrand() {
  await connectDB();

  const existing = await BrandConfigModel.findOne();
  if (existing) {
    const changed =
      existing.supportPhone !== DEFAULT_BRAND.supportPhone ||
      existing.supportEmail !== DEFAULT_BRAND.supportEmail;
    if (changed) {
      existing.supportPhone = DEFAULT_BRAND.supportPhone;
      existing.supportEmail = DEFAULT_BRAND.supportEmail;
      await existing.save();
      console.log("[seed] brandConfig support contact updated:");
    } else {
      console.log("[seed] brandConfig already up to date — leaving it unchanged:");
    }
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
