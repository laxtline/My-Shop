import { Schema, model, type InferSchemaType } from "mongoose";

const wishlistSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    items: { type: [{ type: Schema.Types.ObjectId, ref: "Product" }], default: [] },
  },
  { timestamps: true }
);

export type WishlistDoc = InferSchemaType<typeof wishlistSchema>;

export const WishlistModel = model("Wishlist", wishlistSchema);
