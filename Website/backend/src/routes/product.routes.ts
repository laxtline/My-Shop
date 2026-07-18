import { Router } from "express";
import {
  listProducts,
  listAllProductsAdmin,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../controllers/productController.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { validateBody } from "../utils/validate.js";
import { productCreateSchema, productUpdateSchema } from "../validation/schemas.js";

const router = Router();

router.get("/", asyncHandler(listProducts));
// Admin listing must be declared before "/:slug" so it isn't captured as a slug.
router.get("/admin/all", requireAuth, requireAdmin, asyncHandler(listAllProductsAdmin));
router.get("/:slug", asyncHandler(getProduct));
router.post("/", requireAuth, requireAdmin, validateBody(productCreateSchema), asyncHandler(createProduct));
router.put("/:id", requireAuth, requireAdmin, validateBody(productUpdateSchema), asyncHandler(updateProduct));
router.delete("/:id", requireAuth, requireAdmin, asyncHandler(deleteProduct));

export default router;
