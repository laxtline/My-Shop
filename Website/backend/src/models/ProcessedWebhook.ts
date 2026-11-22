import { Schema, model, type InferSchemaType } from 'mongoose';

/**
 * Durable idempotency ledger for provider webhooks. External providers retry
 * aggressively; a database-backed ledger (unlike an in-memory Set) survives
 * restarts and multi-instance deployments.
 */
const processedWebhookSchema = new Schema(
  {
    provider: { type: String, required: true },
    eventId: { type: String, required: true },
    eventType: { type: String, default: '' },
    processedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

processedWebhookSchema.index({ provider: 1, eventId: 1 }, { unique: true });
// Expire ledger rows after 90 days; providers do not retry that long.
processedWebhookSchema.index({ processedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const ProcessedWebhookModel = model('ProcessedWebhook', processedWebhookSchema);
export type ProcessedWebhookDoc = InferSchemaType<typeof processedWebhookSchema>;
