import { Schema, model, type InferSchemaType } from "mongoose";

const cartItemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, required: true, min: 1, default: 1 },
  },
  { _id: false }
);

const cartSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    items: { type: [cartItemSchema], default: [] },
    lastUpdatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export type CartDoc = InferSchemaType<typeof cartSchema>;

export const CartModel = model("Cart", cartSchema);
