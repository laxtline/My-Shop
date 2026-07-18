# Ramachandra Traders — Mobile App (Expo)

A React Native (Expo) app that reuses the **same backend API** and the
**`@shared`** types as the website. This is a runnable starter covering the core
shopping flow: home → product detail → cart.

> Expo is cross-platform: this one project runs on **both Android and iOS**
> (and web). The `iOSApp/` folder points here — there is no separate codebase.

## What's included

- `app/` — screens via **expo-router** (file-based routing)
  - `index.tsx` — home: hero + product grid (live from `/api/products`)
  - `product/[slug].tsx` — product detail + add to cart (`/api/products/:slug`)
  - `cart.tsx` — in-memory cart + demo checkout
- `src/lib/api.ts` — fetch wrapper, imports `ApiResponse` from `@shared/types`
- `src/lib/cart.tsx` — cart context
- `src/lib/theme.ts` — brand colours matching the website

## Run it

```bash
cd AndroidApp
npm install
npm start          # then press "a" (Android emulator) or scan the QR in Expo Go
```

**Important — API URL:** set it in `app.json` → `expo.extra.apiUrl`.
- Android emulator: `http://10.0.2.2:5000`
- Physical phone (Expo Go): your computer's LAN IP, e.g. `http://192.168.1.5:5000`
- Deployed: your Render URL, e.g. `https://ramachandra-traders-api.onrender.com`

(`localhost` won't work from a device — that points at the phone itself.)

## Next steps (to reach website parity)

- **Auth:** Google Sign-In (`expo-auth-session`) → POST the credential to
  `/api/auth/google`, store the JWT (SecureStore), send it as a Bearer token.
- **Server cart/orders:** swap the in-memory cart for `/api/cart` +
  `/api/orders` (COD + Razorpay) once auth is in.
- **More screens:** categories, search, wishlist, orders, account — all endpoints
  already exist and return `@shared` types.
- **Build:** `eas build -p android` / `eas build -p ios`.

## Rules

- Import types/constants from `../shared` only — never from `/Website` or `/iOSApp`.
- Fetch brand config from `/api/brand`; don't hardcode store name/logo.
