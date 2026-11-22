import { OrderModel } from '../models/Order.js';
import { ProductModel } from '../models/Product.js';
import mongoose from 'mongoose';

/**
 * Release stock from abandoned/unpaid orders.
 * Runs periodically to clean up orders that have been in PLACED/PENDING/FAILED state for too long.
 *
 * For COD orders: Release stock if order is older than COD_EXPIRY_HOURS and still PLACED
 * For RAZORPAY orders: Release stock if order is older than RAZORPAY_EXPIRY_HOURS and paymentStatus is PENDING or FAILED
 */

const COD_EXPIRY_HOURS = 24; // 24 hours for COD orders
const RAZORPAY_EXPIRY_HOURS = 2; // 2 hours for online payment orders

interface CleanupResult {
  processed: number;
  cancelled: number;
  stockReleased: number;
  errors: string[];
}

export async function cleanupAbandonedOrders(): Promise<CleanupResult> {
  const result: CleanupResult = {
    processed: 0,
    cancelled: 0,
    stockReleased: 0,
    errors: [],
  };

  const now = new Date();
  const codCutoff = new Date(now.getTime() - COD_EXPIRY_HOURS * 60 * 60 * 1000);
  const razorpayCutoff = new Date(now.getTime() - RAZORPAY_EXPIRY_HOURS * 60 * 60 * 1000);

  try {
    // Find abandoned COD orders (PLACED status, older than cutoff)
    const abandonedCodOrders = await OrderModel.find({
      paymentMethod: 'COD',
      paymentStatus: 'PENDING',
      status: 'PLACED',
      createdAt: { $lt: codCutoff },
    }).session(null);

    // Find abandoned Razorpay orders (PENDING or FAILED payment, older than cutoff)
    // FAILED payments also need cleanup as they may have reserved stock
    const abandonedRazorpayOrders = await OrderModel.find({
      paymentMethod: 'RAZORPAY',
      paymentStatus: { $in: ['PENDING', 'FAILED'] },
      status: 'PLACED',
      createdAt: { $lt: razorpayCutoff },
    }).session(null);

    const allAbandoned = [...abandonedCodOrders, ...abandonedRazorpayOrders];
    result.processed = allAbandoned.length;

    for (const order of allAbandoned) {
      try {
        await mongoose.connection.transaction(async (session) => {
          // Release stock for each item
          for (const line of order.items) {
            if (line.product) {
              const updateResult = await ProductModel.updateOne(
                { _id: line.product },
                { $inc: { stock: line.quantity } },
                { session }
              );
              if (updateResult.modifiedCount > 0) {
                result.stockReleased += line.quantity;
              }
            }
          }

          // Cancel the order
          order.status = 'CANCELLED';
          order.paymentStatus = 'FAILED';
          order.statusHistory.push({
            status: 'CANCELLED',
            timestamp: new Date(),
            note: `Auto-cancelled: abandoned ${order.paymentMethod} order (no payment/confirmation within expiry period)`,
          });
          await order.save({ session });
        });

        result.cancelled++;
        console.log(`[cleanup] Cancelled abandoned order ${order._id} (${order.paymentMethod})`);
      } catch (orderError) {
        const errorMsg = `Failed to cancel order ${order._id}: ${orderError instanceof Error ? orderError.message : 'Unknown error'}`;
        result.errors.push(errorMsg);
        console.error(`[cleanup] ${errorMsg}`);
      }
    }

    if (result.cancelled > 0) {
      console.log(`[cleanup] Completed: ${result.cancelled} orders cancelled, ${result.stockReleased} units of stock released`);
    }
  } catch (error) {
    const errorMsg = `Cleanup job failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    result.errors.push(errorMsg);
    console.error(`[cleanup] ${errorMsg}`);
  }

  return result;
}

/**
 * Start the cleanup job (runs every hour by default).
 * In production, use a proper cron/scheduler like node-cron or bullmq.
 */
export function startCleanupJob(intervalMinutes: number = 60): NodeJS.Timeout {
  console.log(`[cleanup] Starting abandoned order cleanup job (every ${intervalMinutes} minutes)`);

  // Run once immediately
  cleanupAbandonedOrders().catch(console.error);

  // Then run on interval
  return setInterval(() => {
    cleanupAbandonedOrders().catch(console.error);
  }, intervalMinutes * 60 * 1000);
}

/**
 * Stop the cleanup job.
 */
export function stopCleanupJob(interval: NodeJS.Timeout): void {
  clearInterval(interval);
  console.log('[cleanup] Cleanup job stopped');
}