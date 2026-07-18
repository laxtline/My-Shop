import { Schema, model, type InferSchemaType } from "mongoose";
import { roleForEmail } from "@shared/constants/index.js";

const savedAddressSchema = new Schema({
  fullName: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  line1: { type: String, required: true, trim: true },
  line2: { type: String, default: "", trim: true },
  city: { type: String, required: true, trim: true },
  state: { type: String, required: true, trim: true },
  pincode: { type: String, required: true, trim: true },
  isDefault: { type: Boolean, default: false },
});

const userSchema = new Schema(
  {
    googleId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    name: { type: String, required: true },
    picture: { type: String },
    role: { type: String, enum: ["ADMIN", "USER"], required: true, default: "USER" },
    addresses: { type: [savedAddressSchema], default: [] },
  },
  { timestamps: true }
);

// Enforce the canonical role rule on every save — role is derived from email,
// never set by the client.
userSchema.pre("save", function (next) {
  this.role = roleForEmail(this.email);
  next();
});

export type UserDoc = InferSchemaType<typeof userSchema>;

export const UserModel = model("User", userSchema);
