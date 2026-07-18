import { Router } from "express";
import {
  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../controllers/categoryController.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { validateBody } from "../utils/validate.js";
import { categoryCreateSchema, categoryUpdateSchema } from "../validation/schemas.js";

const router = Router();

router.get("/", asyncHandler(listCategories));
router.get("/:slug", asyncHandler(getCategory));
router.post("/", requireAuth, requireAdmin, validateBody(categoryCreateSchema), asyncHandler(createCategory));
router.put("/:id", requireAuth, requireAdmin, validateBody(categoryUpdateSchema), asyncHandler(updateCategory));
router.delete("/:id", requireAuth, requireAdmin, asyncHandler(deleteCategory));

export default router;
