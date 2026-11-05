import mongoose from 'mongoose';
import type { Request, Response } from 'express';
import { ApiError } from '../utils/ApiError.js';

const clients = new Set<Response>();
let stream: ReturnType<NonNullable<typeof mongoose.connection.db>['watch']> | null = null;
let opening: Promise<void> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | undefined;

function broadcast() {
  const message = `event: update\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`;
  for (const client of clients) {
    // prevent slow clients from growing write buffer
    if (client.writableLength > 65536) client.end();
    else client.write(message);
  }
}

async function ensureStream() {
  if (stream) return;
  if (opening) return opening;
  opening = (async () => {
    if (!mongoose.connection.db) throw new ApiError(503, 'Database is unavailable.');
    const next = mongoose.connection.db.watch([
      { $match: { 'ns.coll': { $in: ['orders', 'coupons', 'couponusages'] }, operationType: { $in: ['insert', 'update', 'replace', 'delete'] } } },
    ], { maxAwaitTimeMS: 1000 });
    try {
      await next.tryNext();
      stream = next;
      next.on('change', broadcast);
      next.on('error', () => {
        if (stream === next) stream = null;
        for (const client of clients) client.end();
        void next.close().catch(() => {});
      });
    } catch (error) {
      await next.close().catch(() => {});
      throw new ApiError(503, 'Live updates require MongoDB replica set or Atlas.');
    }
  })().finally(() => { opening = null; });
  return opening;
}

// One change stream per API process; works across replicas
export async function adminEvents(req: Request, res: Response) {
  clearTimeout(idleTimer);
  await ensureStream();
  res.status(200).set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  clients.add(res);
  res.write('retry: 3000\nevent: ready\ndata: {}\n\n');
  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 20000);
  // force reconnect after 5 min to reauth
  const expiry = setTimeout(() => res.end(), 5 * 60 * 1000);
  const cleanup = () => {
    clearInterval(heartbeat);
    clearTimeout(expiry);
    clients.delete(res);
    if (!clients.size) idleTimer = setTimeout(() => void closeRealtime(), 10000);
  };
  res.on('close', cleanup);
}

export async function closeRealtime() {
  clearTimeout(idleTimer);
  for (const client of clients) client.end();
  clients.clear();
  const current = stream;
  stream = null;
  await current?.close().catch(() => {});
}
