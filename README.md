# Ramachandra Traders

A full-stack e-commerce platform for building materials and home interiors — tiles, paints, electrical supplies, and home décor. Built as a monorepo with shared TypeScript types across web and mobile.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)](https://nextjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green.svg)](https://www.mongodb.com/atlas)
[![Expo](https://img.shields.io/badge/Expo-51-000020.svg)](https://expo.dev/)

---

## Overview

**Ramachandra Traders** is a production-ready e-commerce platform featuring a Next.js storefront, Express REST API, and a React Native mobile app (Expo). The project demonstrates modern full-stack development practices including type-safe API contracts, JWT authentication with Google OAuth, server-side rendering, and a shared type system that prevents drift between frontend, backend, and mobile clients.

> **Built for:** Portfolio demonstration — showcases end-to-end full-stack capabilities with clean architecture, type safety, and real-world features (payments, auth, admin dashboard, push notifications).

---

## About the Developer

**Suryakanta Pradhan** — MCA Graduate (2024) | Python + Full Stack Developer

**Skills:** Python, HTML, CSS, JavaScript, React/Next.js, Node.js/Express, MongoDB, React Native/Expo, TypeScript, Redux Toolkit, Tailwind CSS, Google OAuth, Razorpay, REST APIs, Git/GitHub, basic AI/LLM integration

**No:** ML, Java, C++

This project was built as a **placement portfolio piece** during my MCA. It represents 4+ months of iterative development — from initial schema design through deployment — with every feature implemented, tested, and debugged hands-on. The codebase reflects real-world decision-making: schema trade-offs, state management choices, error handling patterns, and deployment constraints I encountered and resolved myself.

> **Honest disclaimer:** AI tools (Claude, Copilot) were used for scaffolding, boilerplate, and debugging assistance — but every architectural decision, bug fix, and feature integration was mine. The commit history shows the actual evolution: failed approaches, refactors, and incremental improvements over time.

---

## Architecture

```text
ramachandra-traders/
├── Website/
│   ├── backend/          # Express + TypeScript REST API
│   │   ├── src/
│   │   │   ├── controllers/   # Request handlers
│   │   │   ├── middleware/    # Auth, validation, error handling
│   │   │   ├── models/        # Mongoose schemas
│   │   │   ├── routes/        # API route definitions
│   │   │   ├── seed/          # Database seeding
│   │   │   ├── utils/         # Helpers, pagination, validation
│   │   │   └── validation/    # Zod schemas
│   │   └── package.json
│   │
│   └── frontend/         # Next.js 15 App Router
│       ├── src/
│       │   ├── app/           # Pages & layouts (App Router)
│       │   ├── components/    # React components (storefront + admin)
│       │   ├── hooks/         # Custom React hooks
│       │   ├── lib/           # API client, utilities
│       │   └── store/         # Redux Toolkit slices
│       └── package.json
│
├── AndroidApp/           # React Native + Expo (runs on iOS/Android)
│   ├── app/              # Expo Router file-based routing
│   ├── components/       # UI components
│   ├── src/
│   │   ├── lib/          # API client, utilities
│   │   └── store/        # Redux Toolkit slices
│   └── package.json
│
└── shared/               # Shared TypeScript types & constants (@shared/*)
    ├── types/            # API contracts, DTOs, enums
    ├── constants/        # Admin email, support contact, default brand
    └── social.ts         # Social media links (single source of truth)
```

**Key architectural decision:** The `shared/` package is consumed via TypeScript path aliases (`@shared/*`) by all three apps. This ensures the API contract is a single source of truth — frontend, backend, and mobile cannot drift apart.

---

## Features

### Storefront (Customer-facing)

- **Authentication** — Google OAuth 2.0 with JWT in httpOnly cookies; session bootstrap via `fetchMe`
- **Product Catalog** — Category filtering, sorting, pagination, search with debounce
- **Product Detail** — Image gallery, bulk pricing tiers, GST breakdown, customer reviews
- **Cart & Wishlist** — Server-persisted per user; optimistic UI updates
- **Checkout** — Cash on Delivery + Razorpay online payments (test mode)
- **Coupons** — Percent/flat discounts validated server-side
- **Addresses** — Multiple saved addresses with default selection
- **Orders** — Full history with timeline tracking (PLACED → DELIVERED), cancellation with automatic restock
- **Guest Checkout** — Place order without account; login prompt appears on submit
- **Real-time Notifications** — Email via Resend (optional), push via Expo (mobile)
- **SEO** — Dynamic sitemap.xml, robots.txt, Open Graph, JSON-LD product schema
- **Dark Mode** — System preference + manual toggle, persisted in localStorage

### Admin Dashboard

- **Order Management** — State machine workflow with transition validation
- **Product & Category CRUD** — Multi-image upload (ImageKit), bulk pricing, inventory
- **Coupon Management** — Create/edit/disable with usage tracking
- **Analytics** — Revenue chart (Recharts), top-selling products, 30-day window

### Mobile App (Expo / React Native)

- Feature parity with web storefront
- Expo Router for file-based navigation
- Push notifications via Expo Push Service
- Brand config loaded from API (splash screen, theme color, logo)
- Track order screen with visual timeline

---

## Tech Stack

| Layer | Technology |
| ----- | ---------- |
| **Frontend** | Next.js 15 (App Router), React 19, TypeScript 5, Tailwind CSS, Redux Toolkit |
| **Backend** | Node.js 20, Express 5, TypeScript, Mongoose 8, JWT (jsonwebtoken), Google OAuth |
| **Database** | MongoDB (Atlas), Mongoose ODM |
| **Payments** | Razorpay (test mode) |
| **Email** | Resend HTTP API |
| **Images** | ImageKit.io (CDN + transformations) |
| **Mobile** | React Native, Expo 51, expo-router, Expo Push Notifications |
| **Testing** | mongodb-memory-server (smoke tests) |
| **Deployment** | Vercel (frontend), Render (backend), MongoDB Atlas |

---

## Getting Started

### Prerequisites
- Node.js 20+
- MongoDB (local or [MongoDB Atlas](https://www.mongodb.com/atlas) free tier)
- Google Cloud Console project for OAuth credentials
- [ImageKit.io](https://imagekit.io/) account (optional, for image uploads)
- [Razorpay](https://razorpay.com/) test keys (optional, for online payments)
- [Resend](https://resend.com/) API key (optional, for emails)

### Backend Setup
```bash
cd Website/backend

# Copy environment template and fill in values
cp .env.example .env

# Required variables:
# MONGODB_URI=mongodb+srv://...
# JWT_SECRET=<64-char random string>
# GOOGLE_CLIENT_ID=<from Google Cloud Console>
# GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
# FRONTEND_URL=http://localhost:3000

npm install
npm run seed        # Seeds brand config, categories, demo products
npm run dev         # Starts on http://localhost:5000
```

### Frontend Setup
```bash
cd Website/frontend

cp .env.local.example .env.local

# Required:
# NEXT_PUBLIC_API_URL=http://localhost:5000
# NEXT_PUBLIC_GOOGLE_CLIENT_ID=<same as backend>

npm install
npm run dev         # Starts on http://localhost:3000
```

### Mobile App Setup
```bash
cd AndroidApp
npm install
npx expo start      # Scan QR with Expo Go, or press 'a' for Android emulator
```

> **Note:** The mobile app uses the same backend API. Ensure the backend is running and accessible (use your machine's LAN IP for physical device testing).

---

## Environment Variables

### Backend (`Website/backend/.env`)
| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | 64+ char random string for JWT signing |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth Client Secret |
| `FRONTEND_URL` | Yes | Frontend origin (e.g., `http://localhost:3000`) |
| `RAZORPAY_KEY_ID` | No | Enables "Pay Online" at checkout |
| `RAZORPAY_KEY_SECRET` | No | Razorpay secret key |
| `RESEND_API_KEY` | No | Enables transactional emails |
| `EMAIL_FROM` | No | Sender email (verified in Resend) |
| `IMAGEKIT_PUBLIC_KEY` | No | ImageKit public key |
| `IMAGEKIT_PRIVATE_KEY` | No | ImageKit private key |
| `IMAGEKIT_URL_ENDPOINT` | No | ImageKit URL endpoint |

### Frontend (`Website/frontend/.env.local`)
| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | Backend API URL |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Yes | Google OAuth Client ID |

### Mobile (`AndroidApp/.env` optional)
| Variable | Required | Description |
|----------|----------|-------------|
| `EXPO_PUBLIC_API_URL` | Yes | Backend API URL (use LAN IP for device testing) |

---

## Available Scripts

### Backend
```bash
npm run dev           # Development with tsx watch
npm run build         # Compile to dist/
npm run start         # Run compiled build
npm run typecheck     # TypeScript type check
npm run lint          # ESLint
npm run seed          # Seed database
npm run test:smoke    # Full e2e flow against in-memory MongoDB
```

### Frontend
```bash
npm run dev           # Next.js dev server
npm run build         # Production build
npm run start         # Run production build
npm run typecheck     # TypeScript type check
npm run lint          # ESLint + Prettier
```

### Mobile
```bash
npx expo start        # Dev server
npx expo start --android   # Android emulator
npx expo start --ios       # iOS simulator
npx eas build --platform android --profile production  # Production build
```

---

## Project Highlights

### Type-Safe API Contracts
All API request/response types live in `shared/types/`. Both backend controllers and frontend/mobile API clients import from `@shared/types`, eliminating runtime contract mismatches.

### Shared Constants
Admin email, support contact, default branding, and social links are defined once in `shared/constants/` and `shared/social.ts`, consumed by all apps.

### Auth Flow
- Google OAuth → backend exchanges code for tokens → sets httpOnly cookie
- Frontend calls `/api/auth/me` on load to bootstrap session (Redux)
- Mobile uses same cookie-based flow via `fetch` with credentials

### Order State Machine

```text
PLACED → CONFIRMED → PACKED → SHIPPED → OUT_FOR_DELIVERY → DELIVERED
                    ↳ CANCELLED (restocks inventory)
```

Transitions validated server-side; invalid transitions return 400.

### Responsive Design
Mobile-first Tailwind CSS with custom breakpoints. Admin dashboard is desktop-optimized; storefront works seamlessly from 320px to 1440px+.

---

## Deployment

### Backend (Render)
1. Connect GitHub repo to Render
2. Create **Web Service** from `Website/backend`
3. Build command: `npm install && npm run build`
4. Start command: `npm run start`
5. Add all environment variables from `.env.example`
6. Deploy — Render provides `https://your-app.onrender.com`

### Frontend (Vercel)
1. Import repo in Vercel
2. Root directory: `Website/frontend`
3. Add `NEXT_PUBLIC_API_URL` (Render backend URL) and `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
4. Deploy — Vercel provides `https://your-app.vercel.app`

### Database (MongoDB Atlas)
1. Create free M0 cluster
2. Whitelist Render IP (or 0.0.0.0/0 for dev)
3. Create database user
4. Use connection string in `MONGODB_URI`

### Mobile (EAS Build)
```bash
cd AndroidApp
npx eas build --platform android --profile production
# Generates .aab for Play Store
```

---

## Production Troubleshooting

### ⚠️ Cross-Origin Cookie Issues (Vercel + Render)

If **logout doesn't work** or **session isn't persisted** on the deployed version:

| Issue | Cause | Fix |
| ----- | ----- | --- |
| Logout doesn't clear session | Cookie not matching for `clearCookie` | Backend sets `SameSite: None; Secure` — ensure `FRONTEND_URL` in backend `.env` matches Vercel URL exactly (no trailing slash) |
| "Not authenticated" on refresh | Cookie not sent cross-origin | Backend CORS `origin` must **reflect request origin** (not `*`), and `credentials: true` — already configured in `app.ts` |
| Google OAuth redirect fails | Mismatched redirect URI | In Google Cloud Console, add **both** Vercel URL (`/api/auth/google/callback`) and Render URL to Authorized Redirect URIs |

**Environment variables that must match exactly:**
```bash
# Backend (Render)
FRONTEND_URL=https://your-app.vercel.app        # No trailing slash!
MONGODB_URI=mongodb+srv://...
JWT_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Frontend (Vercel)
NEXT_PUBLIC_API_URL=https://your-api.onrender.com
NEXT_PUBLIC_GOOGLE_CLIENT_ID=...                # Same as backend
```

**Debug steps:**

1. Open DevTools → Application → Cookies → check `rt_token` exists after login
2. Check `SameSite: None` and `Secure` are set on the cookie
3. Network tab → `/api/auth/logout` → should return 200 and clear cookie
4. Backend logs → verify `clearCookie` is called with `sameSite: "none", secure: true`

---

## Testing

```bash
# Backend smoke test (no external deps)
cd Website/backend
npm run test:smoke

# Frontend type check + build
cd Website/frontend
npm run typecheck && npm run build
```

The smoke test spins up a real Express server against `mongodb-memory-server`, runs through the complete flow (catalog → cart → checkout → admin), and tears down. No MongoDB, no env vars needed.

---

## License

MIT License — feel free to use for learning, reference, or your own projects.

---

## Contact

**Suryakanta Pradhan** — MCA Graduate (Full Stack Developer)

- GitHub: [@your-username](https://github.com/your-username)
- LinkedIn: [linkedin.com/in/your-profile](https://linkedin.com/in/your-profile)
- Email: suryakant321pradhan@gmail.com

> This project was built as a portfolio piece for placement interviews. It demonstrates end-to-end full-stack development with modern tooling, clean architecture, and production-ready patterns.