import { Schema, model, type InferSchemaType } from "mongoose";

const reviewSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // Author details are snapshotted so the list needs no populate.
    userName: { type: String, required: true },
    userPicture: { type: String, default: "" },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: "", trim: true, maxlength: 1000 },
  },
  { timestamps: true }
);

// One review per user per product; writing again updates the existing one.
reviewSchema.index({ product: 1, user: 1 }, { unique: true });

export type ReviewDoc = InferSchemaType<typeof reviewSchema>;

export const ReviewModel = model("Review", reviewSchema);
