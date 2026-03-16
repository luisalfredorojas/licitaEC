import { redis } from "../lib/redis.js";
import { sercopSyncQueue } from "./queues.js";
import { createSyncWorker } from "./sercop-sync.js";
import { createProcessAlertsWorker } from "./process-alerts.js";
import { createSendNotificationsWorker } from "./send-notifications.js";

async function main() {
  console.log("[Workers] Iniciando workers de LicitaEC...");

  // Crear workers
  const syncWorker = createSyncWorker(redis);
  const alertsWorker = createProcessAlertsWorker(redis);
  const notificationsWorker = createSendNotificationsWorker(redis);

  console.log("[Workers] Workers creados:");
  console.log("  - sercop-sync (concurrency: 1)");
  console.log("  - process-alerts (concurrency: 5)");
  console.log("  - send-notifications (concurrency: 10)");

  // Programar cron de sync cada 15 minutos
  await sercopSyncQueue.upsertJobScheduler(
    "sync-scheduler",
    { pattern: "*/15 * * * *" },
    {
      name: "sync",
      data: { type: "sync" },
      opts: {
        attempts: 3,
        backoff: { type: "exponential", delay: 30_000 },
      },
    }
  );

  console.log("[Workers] Cron programado: sync cada 15 minutos");
  console.log("[Workers] Listos y esperando jobs...");

  // Graceful shutdown
  const shutdown = async () => {
    console.log("\n[Workers] Apagando workers...");
    await Promise.all([
      syncWorker.close(),
      alertsWorker.close(),
      notificationsWorker.close(),
    ]);
    await redis.quit();
    console.log("[Workers] Workers cerrados correctamente");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("[Workers] Error fatal:", error);
  process.exit(1);
});
