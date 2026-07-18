import type { Request } from "express";

export interface PageParams {
  page: number;
  limit: number;
  skip: number;
}

/** Parse ?page & ?limit with safe bounds. */
export function getPageParams(req: Request, defaultLimit = 12, maxLimit = 60): PageParams {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number(req.query.limit) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

/** Build the standard paginated envelope. */
export function paginate<T>(items: T[], total: number, page: number, limit: number) {
  return {
    items,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
