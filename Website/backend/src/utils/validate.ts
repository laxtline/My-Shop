import type { NextFunction, Request, Response } from 'express';
import { ApiError } from './ApiError.js';

/**
 * Lightweight request-body validation. Zero dependencies; returns clear 400s
 * through the existing ApiError + errorHandler pipeline. Validation only —
 * it never mutates req.body (controllers still coerce/normalise as before).
 */
export interface FieldRule {
  type?: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  required?: boolean;
  min?: number; // number: min value; string/array: min length
  max?: number; // number: max value; string/array: max length
  enum?: readonly (string | number)[];
  pattern?: RegExp;
  label?: string;
}

export type BodySchema = Record<string, FieldRule>;

function isNumericLike(v: unknown): boolean {
  if (typeof v === 'number') return Number.isFinite(v);
  if (typeof v === 'string' && v.trim() !== '') return Number.isFinite(Number(v));
  return false;
}

function checkField(name: string, value: unknown, rule: FieldRule): string | null {
  const label = rule.label ?? name;
  const present = value !== undefined && value !== null && value !== '';

  if (!present) {
    return rule.required ? `${label} is required.` : null;
  }

  switch (rule.type) {
    case 'string': {
      if (typeof value !== 'string') return `${label} must be text.`;
      if (rule.min != null && value.trim().length < rule.min)
        return `${label} must be at least ${rule.min} character(s).`;
      if (rule.max != null && value.length > rule.max)
        return `${label} must be at most ${rule.max} character(s).`;
      if (rule.pattern && !rule.pattern.test(value)) return `${label} is invalid.`;
      break;
    }
    case 'number':
    case 'integer': {
      if (!isNumericLike(value)) return `${label} must be a number.`;
      const n = Number(value);
      if (rule.type === 'integer' && !Number.isInteger(n)) return `${label} must be a whole number.`;
      if (rule.min != null && n < rule.min) return `${label} must be at least ${rule.min}.`;
      if (rule.max != null && n > rule.max) return `${label} must be at most ${rule.max}.`;
      break;
    }
    case 'boolean':
      if (typeof value !== 'boolean') return `${label} must be true or false.`;
      break;
    case 'array': {
      if (!Array.isArray(value)) return `${label} must be a list.`;
      if (rule.min != null && value.length < rule.min)
        return `${label} must have at least ${rule.min} item(s).`;
      if (rule.max != null && value.length > rule.max)
        return `${label} must have at most ${rule.max} item(s).`;
      break;
    }
    case 'object':
      if (typeof value !== 'object' || Array.isArray(value)) return `${label} must be an object.`;
      break;
  }

  if (rule.enum && !rule.enum.includes(value as string | number)) {
    return `${label} must be one of: ${rule.enum.join(', ')}.`;
  }
  return null;
}

/** Express middleware factory: validates req.body against a schema. */
export function validateBody(schema: BodySchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    for (const [name, rule] of Object.entries(schema)) {
      const error = checkField(name, body[name], rule);
      if (error) throw new ApiError(400, error);
    }
    next();
  };
}
