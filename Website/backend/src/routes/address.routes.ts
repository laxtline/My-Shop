import { Router } from "express";
import {
  listAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
} from "../controllers/addressController.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { validateBody } from "../utils/validate.js";
import { addressSchema } from "../validation/schemas.js";

const router = Router();

router.use(requireAuth);

router.get("/", asyncHandler(listAddresses));
router.post("/", validateBody(addressSchema), asyncHandler(addAddress));
router.put("/:id", validateBody(addressSchema), asyncHandler(updateAddress));
router.delete("/:id", asyncHandler(deleteAddress));

export default router;
