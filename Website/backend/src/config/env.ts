import dotenv from "dotenv";

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required environment variable: ${name}. Copy .env.example to .env and fill it in.`
    );
  }
  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() !== "" ? value : fallback;
}

export const env = {
  nodeEnv: optional("NODE_ENV", "development"),
  port: Number(optional("PORT", "5000")),
  clientOrigin: optional("CLIENT_ORIGIN", "http://localhost:3000"),
  mongoUri: required("MONGODB_URI"),
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: optional("JWT_EXPIRES_IN", "7d"),
  googleClientId: required("GOOGLE_CLIENT_ID"),
  // Online payments (optional). When both are set, Razorpay checkout is enabled.
  razorpayKeyId: optional("RAZORPAY_KEY_ID", ""),
  razorpayKeySecret: optional("RAZORPAY_KEY_SECRET", ""),
  // Email notifications (optional). Uses the Resend HTTP API when configured.
  resendApiKey: optional("RESEND_API_KEY", ""),
  emailFrom: optional("EMAIL_FROM", ""),
};

export const isProd = env.nodeEnv === "production";

/** Razorpay is active only when both credentials are configured. */
export const razorpayEnabled = Boolean(env.razorpayKeyId && env.razorpayKeySecret);

/** Email is active only when an API key and a from-address are configured. */
export const emailEnabled = Boolean(env.resendApiKey && env.emailFrom);
