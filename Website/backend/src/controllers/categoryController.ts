import type { Request, Response } from 'express';
import { CategoryModel } from '../models/Category.js';
import { ApiError } from '../utils/ApiError.js';
import { slugify } from '../utils/slugify.js';
import { ProductModel } from '../models/Product.js';
import { cursorFilter, cursorPage, getPageParams } from '../utils/pagination.js';
import { isValidProductImageUrl } from '@shared/images.js';
import { Types } from 'mongoose';

// GET /api/categories - public. All categories ordered by `order`
export async function listCategories(req: Request, res: Response) {
  const { page, limit, skip } = getPageParams(req, 24, 100);
  const q = String(req.query.q ?? '').trim().normalize('NFKC').toLowerCase().slice(0, 120);
  const filter: Record<string, unknown> = {};
  if (req.query.ids) {
    const ids = String(req.query.ids).split(',');
    if (ids.length > 200 || ids.some((id) => !Types.ObjectId.isValid(id))) throw new ApiError(400, 'Invalid category IDs.');
    filter._id = { $in: ids };
  }
  if (q) filter.nameSearch = { $regex: `^${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` };
  if (req.query.parent) filter.parentCategory = req.query.parent === 'root' ? null : String(req.query.parent);
  const sort = req.query.sort === 'order'
    ? { field: 'order', direction: 1, kind: 'number' } as const
    : { field: 'nameSearch', direction: 1, kind: 'string' } as const;
  const scope = { filter, sort };
  const [rows, total] = await Promise.all([
    CategoryModel.find({ $and: [filter, cursorFilter(req, sort, scope)] }).sort({ [sort.field]: 1, _id: 1 })
      .skip(req.query.cursor ? 0 : skip).limit(limit + 1), CategoryModel.countDocuments(filter),
  ]);
  res.set('Cache-Control', 'public, max-age=15, stale-while-revalidate=30');
  res.json({ success: true, data: cursorPage(rows, total, page, limit, sort, scope) });
}

// GET /api/categories/:slug - public
export async function getCategory(req: Request, res: Response) {
  const category = await CategoryModel.findOne({ slug: req.params.slug });
  if (!category) throw new ApiError(404, 'Category not found.');
  res.json({ success: true, data: category });
}

// POST /api/categories - admin only
export async function createCategory(req: Request, res: Response) {
  const { name, image, parentCategory, order } = req.body ?? {};
  if (!name || typeof name !== 'string') throw new ApiError(400, 'Category name is required.');
  if (image && !isValidProductImageUrl(image)) throw new ApiError(400, 'Use a valid image URL (ImageKit, Cloudinary or uploaded image).');
  if (parentCategory && !await CategoryModel.exists({ _id: parentCategory })) throw new ApiError(400, 'Parent category does not exist.');

  const slug = slugify(name);
  if (await CategoryModel.exists({ slug })) {
    throw new ApiError(409, 'A category with this name already exists.');
  }

  const category = await CategoryModel.create({
    name,
    slug,
    image: image ?? '',
    parentCategory: parentCategory || null,
    order: Number(order) || 0,
  });
  res.status(201).json({ success: true, data: category, message: 'Category created.' });
}

// PUT /api/categories/:id - admin only
export async function updateCategory(req: Request, res: Response) {
  const category = await CategoryModel.findById(req.params.id);
  if (!category) throw new ApiError(404, 'Category not found.');

  const { name, image, parentCategory, order } = req.body ?? {};
  if (image && image !== category.image && !isValidProductImageUrl(image)) throw new ApiError(400, 'Use a valid image URL (ImageKit, Cloudinary or uploaded image).');
  if (parentCategory) {
    let parent = await CategoryModel.findById(parentCategory).select('parentCategory');
    if (!parent) throw new ApiError(400, 'Parent category does not exist.');
    const visited = new Set<string>([String(category._id)]);
    while (parent) {
      if (visited.has(String(parent._id))) throw new ApiError(400, 'Category hierarchy cannot contain a cycle.');
      visited.add(String(parent._id));
      if (visited.size > 100) throw new ApiError(400, 'Category nesting cannot exceed 100 levels.');
      parent = parent.parentCategory ? await CategoryModel.findById(parent.parentCategory).select('parentCategory') : null;
    }
  }
  if (typeof name === 'string' && name.trim()) {
    category.name = name.trim();
    category.slug = slugify(name);
  }
  if (typeof image === 'string') category.image = image;
  if (parentCategory !== undefined) category.parentCategory = parentCategory || null;
  if (order !== undefined) category.order = Number(order) || 0;

  await category.save();
  res.json({ success: true, data: category, message: 'Category updated.' });
}

// DELETE /api/categories/:id - admin only
export async function deleteCategory(req: Request, res: Response) {
  if (await ProductModel.exists({ category: req.params.id }) || await CategoryModel.exists({ parentCategory: req.params.id })) {
    throw new ApiError(409, 'Move or delete this category’s products and child categories first.');
  }
  const deleted = await CategoryModel.findByIdAndDelete(req.params.id);
  if (!deleted) throw new ApiError(404, 'Category not found.');
  res.json({ success: true, message: 'Category deleted.' });
}
