# Ramachandra Traders

A complete shop platform for a single-store building-materials business: a
customer website, an admin dashboard, and native iOS/Android apps — all backed
by one Express + MongoDB API and a shared TypeScript contract.

The shop sells tiles, paints, electrical supplies and home décor. Customers can
browse the catalogue, check delivery to their pincode, pay online (UPI, card,
netbanking) or choose Cash on Delivery, and track the courier shipment. The
owner manages products, orders, refunds and shipments from the admin area.

```text
.
├── Website/
│   ├── backend/        Express 5 + Mongoose 8 + TypeScript API
│   └── frontend/       Next.js 15 storefront + admin (App Router)
├── MobileApp/          Expo / React Native app (iOS + Android)
└── shared/             Shared types, pricing, courier registry (@shared/*)
```

`shared/` is the single source of truth for API contracts. The backend,
website and mobile app all import the same types, so a field cannot drift
between clients.

---

## What is included

### Customer website

- Google sign-in with an httpOnly JWT cookie
- Catalogue with categories, search, sorting, bulk pricing, GST and reviews
- Server-persisted cart and wishlist
- Saved addresses with a default address
- Pincode serviceability check with delivery ETA and COD availability
- Coupons (percent/flat, scoped, usage-limited)
- Checkout with Cash on Delivery or Razorpay online payment
- Order history, cancellation, returns and refund status
- Shipment tracking with courier, AWB, live events and ETA
- SEO metadata, sitemap, JSON-LD and responsive layout

### Admin dashboard (`/admin`)

- Order queue with the fulfilment state machine
- **Record cash collected** for delivered COD orders
- Product, category, coupon and banner management
- Revenue analytics and top products
- **Shipping** tab: carrier settings, create shipment, schedule pickup,
  refresh tracking, download label, cancel shipment
- Refund processing (automatic Razorpay refunds or manual UPI/bank payout)

### Mobile apps (iOS + Android)

- Native catalogue, product, cart and checkout screens
- Google sign-in with a bearer token stored in SecureStore
- Address book (add, edit, delete, set default)
- Native checkout: pincode serviceability, COD / UPI / card / netbanking,
  coupon, live totals
- Online payment through a hosted Razorpay Payment Link, then status polling
  (webhooks are used when configured; polling reconciles otherwise)
- Order list, order detail, shipment tracking, retry payment for unpaid orders
- Expo push token registration after sign-in

---

## Payments

| Method | How it works |
| --- | --- |
| Cash on Delivery | Order is created as `PENDING`; cash is marked collected by an admin after delivery. Optional COD fee is added server-side. |
| UPI / Card / Netbanking | Razorpay. Website uses Checkout.js; mobile uses a hosted Payment Link and polls `/api/payments/status/:orderId`. |
| Refunds | Razorpay refunds API for prepaid orders, with a manual UPI/bank fallback. Cancelling a paid order triggers an automatic refund. |

The payment channel shown on the order is taken from the captured Razorpay
payment, not from what the customer clicked, so reporting stays accurate.

### Razorpay setup

1. Create an account at <https://dashboard.razorpay.com> and start in **Test Mode**.
2. Copy the Key ID and Key Secret into `Website/backend/.env`.
3. Add a webhook pointing to `https://<your-api>/api/payments/razorpay/webhook`
   with the events `payment.captured`, `payment.failed`, `order.paid`,
   `payment_link.paid`, `refund.processed`, `refund.failed`.
4. Put the webhook secret in `RAZORPAY_WEBHOOK_SECRET`.
5. For mobile payment links, set `PUBLIC_API_URL` and optionally
   `MOBILE_PAYMENT_RETURN_URL=https://your-shop.in/orders` (a public http(s)
   page; Razorpay does not accept custom app schemes).

When the keys are blank, online payment is hidden and the shop still works with
Cash on Delivery.

---

## Shipping and couriers

The shop integrates through **Shiprocket** (recommended) or a **direct
Delhivery** contract. One Shiprocket login reaches Ekart, Delhivery, Blue Dart,
DTDC, XpressBees and Shadowfax. Without carrier credentials the shop still
quotes zone-based delivery estimates so checkout and development work offline;
creating a live shipment (AWB, label, pickup) needs one of the two integrations.

### Shiprocket setup

1. Create a Shiprocket account and add a pickup address.
2. Put the login email/password in `SHIPROCKET_EMAIL` / `SHIPROCKET_PASSWORD`
   and the pickup nickname in `SHIPROCKET_PICKUP_LOCATION`.
3. In Shiprocket → Settings → Webhooks, set
   `https://<your-api>/api/shipping/webhook/shiprocket` and add a custom header
   `x-webhook-token: <SHIPROCKET_WEBHOOK_TOKEN>`.
4. Open **Admin → Shipping → Settings** and confirm the warehouse address,
   delivery fee, free-delivery threshold, COD fee, serviceable pincodes and ETA
   bands.

### Direct Delhivery setup

Set `DELHIVERY_API_TOKEN`, `DELHIVERY_PICKUP_LOCATION` and
`DELHIVERY_CLIENT_NAME`. The webhook URL is
`https://<your-api>/api/shipping/webhook/delhivery` with
`DELHIVERY_WEBHOOK_TOKEN`.

### Daily fulfilment flow

1. Customer places and pays for an order.
2. Admin opens **Admin → Shipping**, enters the order id, chooses a courier (or
   leaves it on auto) and clicks **Create**. The shipment gets an AWB and ETA.
3. **Pickup** schedules collection, **Sync** refreshes carrier events, **Label**
   opens the shipping label.
4. Carrier webhooks (or **Sync**) move the order through
   `SHIPPED → OUT_FOR_DELIVERY → DELIVERED`.
5. For COD, the admin clicks **Record cash** once the agent hands over the money.

---

## Quick start

### Prerequisites

- Node.js 20+
- MongoDB 6+ locally, or a MongoDB Atlas cluster
- A Google Cloud OAuth **Web** client
- Optional: Razorpay test keys, Shiprocket/Delhivery credentials, Resend key

### 1. Backend

```bash
cd Website/backend
cp .env.example .env        # fill in the required values
npm install
npm run seed                # brand config, categories, sample products
npm run dev                 # http://localhost:5000
```

Required variables: `MONGODB_URI`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`.
Everything else is optional and the related feature degrades gracefully.

### 2. Website

```bash
cd Website/frontend
cp .env.local.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:5000
npm install
npm run dev                        # http://localhost:3000
```

Sign in with the Google account configured as `ADMIN_EMAIL` in
`shared/constants/index.ts` to unlock `/admin`.

### 3. Mobile app

```bash
cd MobileApp
npm install
npx expo start
```

`app.config.js` reads the API URL from the environment, so for a physical phone
point it at your computer's LAN address:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.5:5000 npx expo start
```

The app also needs a Google OAuth client for its platform. Create an iOS client
and an Android client (package `com.ramachandratraders.app`, with your debug
SHA-1), then run:

```bash
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=...apps.googleusercontent.com \
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=...apps.googleusercontent.com \
EXPO_PUBLIC_API_URL=https://api.your-shop.in \
npx expo start
```

Add the mobile client ids to the backend as a comma-separated
`GOOGLE_MOBILE_CLIENT_IDS` list, otherwise the API rejects their ID tokens.

---

## Environment reference

### Backend (`Website/backend/.env`)

| Variable | Required | Purpose |
| --- | --- | --- |
| `NODE_ENV` | No | `development` / `production` |
| `PORT` | No | API port, default `5000` |
| `CLIENT_ORIGIN` | No | Comma-separated allowed website origins |
| `MONGODB_URI` | **Yes** | MongoDB connection string |
| `JWT_SECRET` | **Yes** | Long random string for session tokens |
| `JWT_EXPIRES_IN` | No | Default `7d` |
| `GOOGLE_CLIENT_ID` | **Yes** | Web OAuth client id |
| `GOOGLE_MOBILE_CLIENT_IDS` | No | Native iOS/Android client ids (comma separated) |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | No | Enables online payments |
| `RAZORPAY_WEBHOOK_SECRET` | No | Verifies Razorpay webhooks |
| `PUBLIC_API_URL` | No | Public HTTPS API origin (images, webhooks) |
| `MOBILE_PAYMENT_RETURN_URL` | No | Public http(s) page after a hosted payment link |
| `SHIPROCKET_EMAIL` / `SHIPROCKET_PASSWORD` | No | Shiprocket aggregator |
| `SHIPROCKET_PICKUP_LOCATION` | No | Shiprocket pickup nickname |
| `SHIPROCKET_WEBHOOK_TOKEN` | No | Shared secret for Shiprocket webhooks |
| `DELHIVERY_API_TOKEN` | No | Direct Delhivery contract |
| `DELHIVERY_PICKUP_LOCATION` / `DELHIVERY_CLIENT_NAME` | No | Delhivery warehouse metadata |
| `DELHIVERY_WEBHOOK_TOKEN` | No | Shared secret for Delhivery webhooks |
| `STORE_PINCODE` / `STORE_CITY` / `STORE_STATE` | No | Default warehouse |
| `RESEND_API_KEY` / `EMAIL_FROM` | No | Transactional email |
| `EXPO_PUSH_ENABLED` | No | Set `true` to send Expo push notifications |
| `REFUND_ENCRYPTION_KEY` | Recommended | Encrypts UPI/bank refund details at rest |

### Frontend (`Website/frontend/.env.local`)

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | **Yes** | Backend origin |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | **Yes** | Same web client id as the backend |

### Mobile (`MobileApp`)

| Variable | Required | Purpose |
| --- | --- | --- |
| `EXPO_PUBLIC_API_URL` | **Yes** | Backend origin (LAN IP on a device) |
| `EXPO_PUBLIC_STOREFRONT_URL` | No | Website origin for share/help links |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | Yes* | Expo Go / fallback OAuth client |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Yes* | iOS native OAuth client |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | Yes* | Android native OAuth client |
| `EXPO_PUBLIC_GOOGLE_REDIRECT_URI` | No | Exact registered redirect URI |
| `EAS_PROJECT_ID` | For builds | Enables Expo push tokens |

\* Provide the ids for the platforms you build.

---

## Building the mobile apps

```bash
cd MobileApp
npx eas login
npx eas init                       # writes EAS_PROJECT_ID
npx eas build --platform android --profile production
npx eas build --platform ios --profile production
npx eas submit --platform android  # Play Store
npx eas submit --platform ios      # App Store
```

`eas.json` has `development`, `preview` and `production` profiles. Replace the
placeholder `https://api.your-shop.in` URLs with the real API before a store
build. Push notifications need an FCM credential (Android) and an APNs key
(iOS) uploaded to EAS.

For local native testing use a development build (`expo run:android` /
`expo run:ios`) rather than Expo Go; Google sign-in and push tokens require the
native client configuration.

---

## Scripts

### Backend

```bash
npm run dev          # tsx watch
npm run typecheck    # tsc --noEmit
npm run test:smoke   # full flow against in-memory MongoDB
npm run seed         # brand + products
```

### Website

```bash
npm run dev          # Next dev server
npm run typecheck    # tsc --noEmit
npm run build        # production build
npm run start        # serve the production build
```

### Mobile

```bash
npx expo start                 # dev server
npx tsc --noEmit               # type check
npx eas build -p android       # production build
```

---

## Deployment

**Backend** — Render / Railway / a VPS. Build with `npm install && npm run
build`, start with `npm run start`, and add every variable from `.env.example`.
Use a MongoDB Atlas cluster and allow the host's IP.

**Website** — Vercel, root directory `Website/frontend`. Set
`NEXT_PUBLIC_API_URL` to the public API and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` to
the web client id. Add the production domain to the backend's `CLIENT_ORIGIN`.

**Webhooks** — Both Razorpay and the carrier need a public HTTPS URL, so
configure them after the API is deployed. `PUBLIC_API_URL` should match that
origin.

**Cookies** — The backend sets `SameSite=None; Secure` in production. The
frontend origin must be listed in `CLIENT_ORIGIN` exactly (no trailing slash)
for login and logout to work cross-site.

---

## Testing

```bash
cd Website/backend && npm run test:smoke
cd Website/frontend && npm run typecheck && npm run build
cd MobileApp && npx tsc --noEmit
```

The smoke test starts a real Express server against `mongodb-memory-server` and
walks through catalogue → cart → checkout → admin, with no external services.

Carrier and Razorpay calls cannot be exercised without credentials; the code
falls back to documented estimates and reports the degraded mode in the admin
shipping settings.

---

## License

MIT
