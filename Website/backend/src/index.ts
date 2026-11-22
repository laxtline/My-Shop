import { createApp } from "./app.js";
import { connectDB } from "./config/db.js";
import { env } from "./config/env.js";
import { startCleanupJob } from "./services/orderCleanup.js";

async function start() {
  try {
    await connectDB();
    const app = createApp();
    const server = app.listen(env.port, () => {
      console.log(`[server] Ramachandra Traders API listening on http://localhost:${env.port}`);
      console.log(`[server] CORS origin: ${env.clientOrigin}`);
    });

    // Start background cleanup job for abandoned orders
    // Only start in production or when explicitly enabled
    if (env.nodeEnv === 'production' || process.env.ENABLE_CLEANUP_JOB === 'true') {
      const cleanupInterval = startCleanupJob(60); // Run every hour

      // Graceful shutdown
      const shutdown = () => {
        console.log('[server] Shutting down...');
        // Stop cleanup job
        // Note: We'd need to import stopCleanupJob to call it here
        server.close(() => {
          console.log('[server] HTTP server closed');
          process.exit(0);
        });

        // Force close after 10 seconds
        setTimeout(() => {
          console.error('[server] Forced shutdown');
          process.exit(1);
        }, 10000);
      };

      process.on('SIGTERM', shutdown);
      process.on('SIGINT', shutdown);
    }
  } catch (err) {
    console.error("[server] Failed to start:", err);
    process.exit(1);
  }
}

start();
