import { env, emailEnabled } from "../config/env.js";
import { getOrCreateBrand } from "../models/BrandConfig.js";

interface OrderLike {
  id?: string;
  items: { title: string; quantity: number; lineTotal: number }[];
  total: number;
  status: string;
  shippingAddress: { fullName: string };
}

const INR = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const shortId = (id?: string) => (id ?? "").slice(-6).toUpperCase();

/**
 * Send an email via the Resend HTTP API. No SMTP dependency.
 * When email is not configured, it logs and returns (never throws) so that
 * order flows are never blocked by email problems.
 */
export async function sendEmail(opts: { to: string; subject: string; html: string }): Promise<void> {
  if (!emailEnabled) {
    console.log(`[email:disabled] would send to ${opts.to}: "${opts.subject}"`);
    return;
  }
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.emailFrom,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
      }),
    });
    if (!resp.ok) {
      console.error("[email] send failed:", resp.status, await resp.text().catch(() => ""));
    }
  } catch (err) {
    console.error("[email] error:", err);
  }
}

function shell(brandName: string, title: string, body: string): string {
  return `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
    <h2 style="color:#2563eb">${brandName}</h2>
    <h3>${title}</h3>
    ${body}
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
    <p style="font-size:12px;color:#64748b">This is an automated message from ${brandName}.</p>
  </div>`;
}

function itemRows(order: OrderLike): string {
  return order.items
    .map(
      (it) =>
        `<tr><td style="padding:4px 0">${it.title} × ${it.quantity}</td><td style="padding:4px 0;text-align:right">${INR(
          it.lineTotal
        )}</td></tr>`
    )
    .join("");
}

/** Order confirmation email. */
export async function sendOrderPlacedEmail(to: string, order: OrderLike): Promise<void> {
  const brand = await getOrCreateBrand().catch(() => null);
  const name = brand?.appName ?? "Ramachandra Traders";
  const body = `
    <p>Hi ${order.shippingAddress.fullName}, thank you for your order!</p>
    <p><strong>Order #${shortId(order.id)}</strong></p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      ${itemRows(order)}
      <tr><td style="padding-top:8px;font-weight:bold">Total</td><td style="padding-top:8px;text-align:right;font-weight:bold">${INR(
        order.total
      )}</td></tr>
    </table>
    <p>We'll notify you as your order progresses.</p>`;
  await sendEmail({ to, subject: `Your ${name} order #${shortId(order.id)} is confirmed`, html: shell(name, "Order confirmed", body) });
}

/** Order status-change email (confirmed / shipped / delivered / cancelled). */
export async function sendOrderStatusEmail(to: string, order: OrderLike): Promise<void> {
  const brand = await getOrCreateBrand().catch(() => null);
  const name = brand?.appName ?? "Ramachandra Traders";
  const pretty = order.status.charAt(0) + order.status.slice(1).toLowerCase();
  const body = `
    <p>Hi ${order.shippingAddress.fullName},</p>
    <p>Your order <strong>#${shortId(order.id)}</strong> is now <strong>${pretty}</strong>.</p>
    <p>Order total: <strong>${INR(order.total)}</strong></p>`;
  await sendEmail({ to, subject: `Order #${shortId(order.id)} update: ${pretty}`, html: shell(name, `Order ${pretty}`, body) });
}
