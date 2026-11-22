import dotenv from 'dotenv';

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(
      `Missing required environment variable: ${name}. Copy .env.example to .env and fill it in.`
    );
  }
  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() !== '' ? value : fallback;
}

export const env = {
  nodeEnv: optional('NODE_ENV', 'development'),
  port: Number(optional('PORT', '5000')),
  clientOrigin: optional('CLIENT_ORIGIN', 'http://localhost:3000'),
  mongoUri: required('MONGODB_URI'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: optional('JWT_EXPIRES_IN', '7d'),
  googleClientId: required('GOOGLE_CLIENT_ID'),
  // Additional OAuth audiences accepted for mobile apps (iOS/Android client
  // ids issue ID tokens with a different `aud` than the web client).
  googleMobileClientIds: optional('GOOGLE_MOBILE_CLIENT_IDS', '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean),
  // Online payments (optional). When both are set, Razorpay checkout is enabled.
  razorpayKeyId: optional('RAZORPAY_KEY_ID', ''),
  razorpayKeySecret: optional('RAZORPAY_KEY_SECRET', ''),
  // Razorpay webhook secret for verifying webhook signatures
  razorpayWebhookSecret: optional('RAZORPAY_WEBHOOK_SECRET', ''),
  // Email notifications (optional). Uses the Resend HTTP API when configured.
  resendApiKey: optional('RESEND_API_KEY', ''),
  emailFrom: optional('EMAIL_FROM', ''),
  // Push notifications (optional). Uses Expo Push Service when configured.
  expoPushEnabled: optional('EXPO_PUSH_ENABLED', 'false') === 'true',
  // Encryption for refund data (required for refunds)
  refundEncryptionKey: optional('REFUND_ENCRYPTION_KEY', ''),
  // Public origin of this API (used for uploaded image URLs and webhook docs).
  publicApiUrl: optional('PUBLIC_API_URL', '').replace(/\/$/, ''),
  // Public http(s) page the hosted payment link returns to (matches the
  // website's order page). Custom app schemes are not accepted by Razorpay.
  mobilePaymentReturnUrl: optional('MOBILE_PAYMENT_RETURN_URL', ''),

  // ---- Shipping / carrier integrations (optional) ----
  // Shiprocket is the recommended aggregator: one connection reaches Ekart,
  // Delhivery, Blue Dart, DTDC, XpressBees and more.
  shiprocketEmail: optional('SHIPROCKET_EMAIL', ''),
  shiprocketPassword: optional('SHIPROCKET_PASSWORD', ''),
  shiprocketBaseUrl: optional('SHIPROCKET_BASE_URL', 'https://apiv2.shiprocket.in'),
  shiprocketPickupLocation: optional('SHIPROCKET_PICKUP_LOCATION', 'Primary Warehouse'),
  shiprocketWebhookToken: optional('SHIPROCKET_WEBHOOK_TOKEN', ''),
  // Direct Delhivery connection (alternative to the aggregator).
  delhiveryApiToken: optional('DELHIVERY_API_TOKEN', ''),
  delhiveryBaseUrl: optional('DELHIVERY_BASE_URL', 'https://track.delhivery.com'),
  delhiveryPickupLocation: optional('DELHIVERY_PICKUP_LOCATION', 'Primary Warehouse'),
  delhiveryClientName: optional('DELHIVERY_CLIENT_NAME', ''),
  delhiveryWebhookToken: optional('DELHIVERY_WEBHOOK_TOKEN', ''),
  // Store origin, used as the default warehouse before admin settings exist.
  storePincode: optional('STORE_PINCODE', '751001'),
  storeCity: optional('STORE_CITY', 'Bhubaneswar'),
  storeState: optional('STORE_STATE', 'Odisha'),
};

export const isProd = env.nodeEnv === 'production';

// Allowed browser origins, parsed from CLIENT_ORIGIN as a comma-separated list.
// A single value keeps working unchanged; multiple values matter on deploy,
// where the production domain and Vercel preview domains differ.
export const allowedOrigins = env.clientOrigin
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean);

/** Razorpay is active only when both credentials are configured. */
export const razorpayEnabled = Boolean(env.razorpayKeyId && env.razorpayKeySecret);

/** Email is active only when an API key and a from-address are configured. */
export const emailEnabled = Boolean(env.resendApiKey && env.emailFrom);

/** Shiprocket (courier aggregator) is active only when credentials exist. */
export const shiprocketEnabled = Boolean(env.shiprocketEmail && env.shiprocketPassword);

/** Direct Delhivery is active only when an API token exists. */
export const delhiveryEnabled = Boolean(env.delhiveryApiToken);

/** True when at least one live carrier integration is configured. */
export const carrierIntegrationEnabled = shiprocketEnabled || delhiveryEnabled;
