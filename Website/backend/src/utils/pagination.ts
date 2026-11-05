import type { Request } from 'express';
import { Types } from 'mongoose';
import { createHash } from 'node:crypto';
import { ApiError } from './ApiError.js';

export interface PageParams {
  page: number;
  limit: number;
  skip: number;
}

// Parse ?page & ?limit with safe bounds.
export function getPageParams(req: Request, defaultLimit = 12, maxLimit = 60): PageParams {
  const page = Math.max(1, Math.floor(Number(req.query.page) || 1));
  const limit = Math.min(maxLimit, Math.max(1, Math.floor(Number(req.query.limit) || defaultLimit)));
  if (!Number.isSafeInteger(page) || (page - 1) * limit > 10000 && !req.query.cursor) {
    throw new ApiError(400, 'Use the next cursor to browse further results.');
  }
  return { page, limit, skip: (page - 1) * limit };
}

export type CursorSort = { field: string; direction: 1 | -1; kind: 'date' | 'number' | 'string' };
const scopeHash = (scope: unknown) => createHash('sha256').update(JSON.stringify(scope)).digest('hex').slice(0, 24);

export function cursorFilter(req: Request, sort: CursorSort, scope: unknown): Record<string, unknown> {
  if (!req.query.cursor) return {};
  try {
    const token = String(req.query.cursor);
    if (token.length > 2000) throw new Error();
    const cursor = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
    if (cursor.scope !== scopeHash(scope) || cursor.field !== sort.field || !Types.ObjectId.isValid(cursor.id)) throw new Error();
    const value = sort.kind === 'date' ? new Date(cursor.value) : cursor.value;
    if (sort.kind === 'date' && !Number.isFinite(value.getTime()) ||
        sort.kind === 'number' && (typeof value !== 'number' || !Number.isFinite(value)) ||
        sort.kind === 'string' && typeof value !== 'string') throw new Error();
    const op = sort.direction === 1 ? '$gt' : '$lt';
    return { $or: [{ [sort.field]: { [op]: value } }, { [sort.field]: value, _id: { [op]: new Types.ObjectId(cursor.id) } }] };
  } catch { throw new ApiError(400, 'Invalid pagination cursor. Start from the first page.'); }
}

export function cursorPage<T>(rows: T[], total: number, page: number, limit: number, sort: CursorSort, scope: unknown) {
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);
  const last = items.at(-1) as Record<string, unknown> | undefined;
  const nextCursor = hasMore && last ? Buffer.from(JSON.stringify({
    scope: scopeHash(scope), field: sort.field, value: last[sort.field], id: String(last._id),
  })).toString('base64url') : null;
  return { ...paginate(items, total, page, limit), nextCursor };
}

// Build the standard paginated envelope.
export function paginate<T>(items: T[], total: number, page: number, limit: number) {
  return {
    items,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
