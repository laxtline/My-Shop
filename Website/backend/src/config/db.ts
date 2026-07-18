import mongoose from "mongoose";
import { env } from "./env.js";

export async function connectDB(): Promise<void> {
  mongoose.set("strictQuery", true);

  // Serialize every document with a string `id` (not `_id`/`__v`). This is the
  // single source of truth for the API's JSON shape and matches @shared/types,
  // which use `id` everywhere. Applied globally so all models stay consistent.
  mongoose.set("toJSON", {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: Record<string, unknown>) => {
      delete ret._id;
      // Subdocuments declared with { _id: false } have no id — drop the null.
      if (ret.id == null) delete ret.id;
      return ret;
    },
  });

  await mongoose.connect(env.mongoUri);
  console.log(`[db] connected to MongoDB (${mongoose.connection.name})`);
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
}
