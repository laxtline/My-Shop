# Ramachandra Traders — Full-Stack E-commerce Platform

E-commerce platform for **Tiles · Paints · Electrical · Home Interiors**.
_"Everything for Your Dream Home — From Cement to Color, All in One Place."_

A production-style, end-to-end **TypeScript monorepo**: Next.js 15 storefront,
Express + MongoDB REST API, full admin dashboard, and a React Native (Expo)
mobile app — all sharing one type-safe API contract.

> 🔗 **Live demo:** _add your deployed URL here_ · **Admin demo:** see [docs/DEPLOY_GUIDE.txt](docs/DEPLOY_GUIDE.txt)

---

## Features

### Storefront

- Google Sign-In (OAuth) with JWT sessions in httpOnly cookies
- Product catalog with filters (category / brand / price / rating / discount), 5 sort modes, pagination
- Product detail: image gallery, bulk-pricing tiers, GST, stock badges, reviews & ratings
- Cart, wishlist, and search — per-user, server-persisted, optimistic UI updates
- Checkout: **Cash on Delivery + Razorpay online payment** (server-verified signature), autocomplete hints on address fields, phone/pincode pattern validation
- Coupons (percent/flat, min-order, expiry) — discount always recomputed server-side
- Saved delivery addresses with default auto-fill
- Order history with status-tracking timeline, cancellation with restock, printable **tax invoice**
- Email notifications on order placed / status change (Resend API)
- Toast notifications for cart actions, wishlist, checkout feedback
- "You may also like" + "Recently viewed" recommendation rails
- Dark mode 🌙, mobile-first responsive layout, skeleton loaders, error boundaries, ARIA labels on interactive elements
- SEO: dynamic sitemap.xml, robots.txt, Open Graph, per-product JSON-LD structured data

### Admin dashboard

- Orders: view all, guarded status state machine (PLACED → … → DELIVERED)
- Products & categories: full CRUD with multi-image upload
- Coupons: create / list / deactivate / delete
- Analytics: headline stats, 14-day revenue chart, top-5 selling products

### Engineering

- Server-authoritative pricing & stock (clients can never set prices), atomic stock decrement, immutable order line-item snapshots
- Role-based access control (ADMIN vs USER) enforced in middleware
- Security: Helmet, credentialed CORS allow-list (comma-separated for multiple domains; blocked origins get a 403, not a misleading 500), two-tier rate limiting (auth endpoints separated from session checks), request-size limits, input validation on every write endpoint, MongoDB duplicate-key error handling, fail-fast env validation
- Dynamic branding (store name, logo, theme color) loaded from the database — re-skin with zero code changes
- Complete REST API documentation: Postman collection with 41 endpoints (`docs/Ramachandra_Traders_API.postman_collection.json`)
- End-to-end smoke test: boots the real server against in-memory MongoDB and asserts the full catalog → cart → checkout → admin flow (`npm run test:smoke`)

## Tech stack

| Layer    | Tech |
| -------- | ---- |
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Redux Toolkit |
| Backend  | Node.js, Express 4, TypeScript, Mongoose 8 (MongoDB), JWT, Google OAuth |
| Payments | Razorpay (test mode; optional via env flag) |
| Email    | Resend HTTP API (optional via env flag) |
| Mobile   | React Native (Expo, expo-router) — Android & iOS from one codebase |
| Testing  | End-to-end API smoke test with mongodb-memory-server |
| Deploy   | Vercel (frontend) + Render (backend, `render.yaml`) + MongoDB Atlas |

## Monorepo layout

| Folder        | What it is |
| ------------- | ---------- |
| `Website/backend`  | Express + MongoDB REST API (auth, catalog, cart, orders, payments, admin) |
| `Website/frontend` | Next.js 15 storefront + admin dashboard |
| `AndroidApp/` | React Native (Expo) app — home, product detail, cart (also runs on iOS) |
| `iOSApp/`     | Points at the same Expo project (Expo is cross-platform) |
| `shared/`     | Shared TypeScript types, API contracts, constants (`@shared/*`) — single source of truth |
| `docs/`       | Setup, deploy, and project guides |

Code is **not** mixed between apps; the only shared code is `/shared`, consumed
via the `@shared/*` TypeScript path alias — so the client and server can never
drift apart on the API contract.

## Quick start

Prerequisites: Node.js 20+, a MongoDB connection string (local or free
[Atlas](https://www.mongodb.com/atlas)), and a Google OAuth Client ID.

```bash
# Backend (Terminal 1)
cd Website/backend
cp .env.example .env          # fill MONGODB_URI, JWT_SECRET, GOOGLE_CLIENT_ID
npm install
npm run seed                  # loads branding + 72 demo products
npm run dev                   # http://localhost:5000

# Frontend (Terminal 2)
cd Website/frontend
cp .env.local.example .env.local
npm install
npm run dev                   # http://localhost:3000
```

Open <http://localhost:3000> → sign in with Google → browse the store.

Optional feature flags (backend `.env`) — the app works fully without them:

- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` → enables "Pay Online" at checkout
- `RESEND_API_KEY` / `EMAIL_FROM` → enables order emails (otherwise logged to console)

## Testing

```bash
cd Website/backend
npm run typecheck
npm run test:smoke   # full e2e flow against in-memory MongoDB — no .env or internet needed

cd ../frontend
npm run typecheck
npm run build
```

## Deployment

Free-tier deploy: MongoDB Atlas + Render (backend) + Vercel (frontend).
Follow [docs/DEPLOY_GUIDE.txt](docs/DEPLOY_GUIDE.txt) top to bottom — includes
every environment variable and a post-deploy browser checklist.
`render.yaml` in the repo root is the Render blueprint.

## Screenshots

_Add screenshots here after deploying: home, product page, cart, checkout, admin dashboard, analytics._

## License

MIT — see [LICENSE](LICENSE).
