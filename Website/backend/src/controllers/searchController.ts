import type { Request, Response } from 'express';
import { productListing } from './productController.js';

/** Indexed full-text search combined with catalogue filters and cursor paging. */
export function searchProducts(req: Request, res: Response) {
  return productListing(req, res, false, true);
}
