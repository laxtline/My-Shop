// Shared constants and the canonical role rule. Imported by backend and all clients
// so the "admin email => ADMIN" logic lives in exactly one place.

import type { Role } from '../types';

// The one account that is granted ADMIN. Everyone else is a USER.
// TODO: move this to env var in production
export const ADMIN_EMAIL = 'suryakant321pradhan@gmail.com';

/**
 * Public support inbox shown on the storefront (footer, invoices, order emails).
 * Deliberately separate from ADMIN_EMAIL: who can administer the shop is an
 * access-control decision, and must not leak the operator's personal address
 * onto customer-facing pages.
 */
export const SUPPORT_EMAIL = 'ramachandratraders2000@gmail.com';

// Fixed support phone used for "Call to Order" / "WhatsApp Order" features.
export const SUPPORT_PHONE = '6370419708';

// Canonical role rule. The ONLY place this decision is made.
export function roleForEmail(email: string): Role {
  return email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase() ? 'ADMIN' : 'USER';
}

// Default branding, used to seed brandConfig. Frontend must still fetch live values.
export const DEFAULT_BRAND = {
  appName: 'Ramachandra Traders',
  tagline: 'Everything for Your Dream Home',
  logoUrl: '/logo.svg',
  supportPhone: SUPPORT_PHONE,
  supportEmail: SUPPORT_EMAIL,
  themeColor: '#2563eb',
} as const;
