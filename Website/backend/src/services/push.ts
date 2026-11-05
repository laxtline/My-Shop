import { env } from '../config/env.js';
import { UserModel } from '../models/User.js';

interface PushMessage { to: string; title: string; body: string; data?: Record<string, string>; }

// Send push via Expo. Logs if disabled.
export async function sendPushNotification(message: PushMessage): Promise<void> {
  const expoPushUrl = 'https://exp.host/--/api/v2/push/send';

  if (!env.expoPushEnabled) {
    console.log('[push:disabled] would send:', message);
    return;
  }

  try {
    const response = await fetch(expoPushUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        to: message.to,
        title: message.title,
        body: message.body,
        data: message.data,
        sound: 'default',
        priority: 'high',
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      console.error('[push] send failed:', result);
    }
  } catch (error) {
    console.error('[push] error:', error);
  }
}

// Send push to all admins with tokens
export async function notifyAdmins(title: string, body: string, data?: Record<string, string>): Promise<void> {
  const admins = await UserModel.find({ role: 'ADMIN', pushToken: { $ne: '', $exists: true } })
    .select('pushToken')
    .lean();

  if (!admins.length) {
    console.log('[push] No admin users with push tokens found');
    return;
  }

  await Promise.all(
    admins.map((admin) =>
      sendPushNotification({
        to: admin.pushToken,
        title,
        body,
        data,
      })
    )
  );
}

// Notify admins of new order
export async function notifyNewOrder(orderId: string, customerName: string, total: number): Promise<void> {
  const shortId = orderId.slice(-6).toUpperCase();
  await notifyAdmins(
    '🛍️ New Order Received',
    `#${shortId} from ${customerName} — ₹${Math.round(total).toLocaleString('en-IN')}`,
    { type: 'new_order', orderId }
  );
}

// Notify admins of order status change
export async function notifyOrderStatusChange(orderId: string, status: string, customerName: string): Promise<void> {
  const shortId = orderId.slice(-6).toUpperCase();
  await notifyAdmins(
    '📦 Order Status Update',
    `#${shortId} for ${customerName} is now ${status.charAt(0) + status.slice(1).toLowerCase()}`,
    { type: 'order_status', orderId, status }
  );
}

// Notify admins of coupon usage
export async function notifyCouponUsage(couponCode: string, customerName: string, discount: number): Promise<void> {
  await notifyAdmins(
    '🎟️ Coupon Used',
    `${customerName} used ${couponCode} for ₹${Math.round(discount).toLocaleString('en-IN')} discount`,
    { type: 'coupon_usage', couponCode, discount: String(discount) }
  );
}