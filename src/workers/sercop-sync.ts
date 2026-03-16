import { Worker, type Job } from "bullmq";
import { prisma } from "../lib/prisma.js";
import { sercopClient } from "../lib/sercop-client.js";
import {
  transformRelease,
  transformAwards,
  extractCpcCodes,
  mapOcpMethodType,
} from "../lib/ocds-transformer.js";
import type { OCDSRelease } from "../types/ocds.js";
import { processAlertsQueue, sendNotificationsQueue } from "./queues.js";
import { redis } from "../lib/redis.js";

export interface SyncJobData {
  type: "sync" | "bulk";
  year?: number;
}

export function createSyncWorker(connection: typeof redis) {
  return new Worker<SyncJobData>(
    "sercop-sync",
    async (job: Job<SyncJobData>) => {
      if (job.data.type === "bulk") {
        await handleBulkSync(job);
      } else {
        await handleIncrementalSync(job);
      }
    },
    {
      connection,
      concurrency: 1,
      autorun: true,
    }
  );
}

async function handleIncrementalSync(job: Job<SyncJobData>) {
  const syncLog = await prisma.syncLog.create({
    data: { status: "RUNNING" },
  });

  let totalProcessed = 0;
  let newRecords = 0;
  let updatedRecords = 0;
  let errors = 0;

  try {
    // Buscar último sync exitoso
    const lastSync = await prisma.syncLog.findFirst({
      where: { status: { in: ["COMPLETED", "PARTIAL"] } },
      orderBy: { startedAt: "desc" },
    });

    const currentYear = new Date().getFullYear();

    if (!lastSync) {
      // Primera vez: cargar año actual y anterior
      console.log("[Sync] No hay sync previo. Iniciando carga bulk...");
      await enqueueBulkLoad(currentYear);
      await enqueueBulkLoad(currentYear - 1);

      await prisma.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          totalProcessed: 0,
        },
      });
      return;
    }

    // Sync incremental: fetch de releases recientes
    console.log(`[Sync] Sync incremental desde ${lastSync.startedAt.toISOString()}`);

    const response = await sercopClient.searchProcesses({
      year: currentYear,
      page: 1,
    });

    const totalPages = Math.min(response.meta?.pages ?? 1, 10); // Limitar a 10 páginas en incremental
    const allReleases: OCDSRelease[] = [...response.releases];

    for (let page = 2; page <= totalPages; page++) {
      const pageResponse = await sercopClient.searchProcesses({
        year: currentYear,
        page,
      });
      allReleases.push(...pageResponse.releases);
    }

    // Procesar cada release
    for (const release of allReleases) {
      try {
        const result = await upsertProcess(release);
        totalProcessed++;

        if (result.isNew) newRecords++;
        else if (result.wasUpdated) updatedRecords++;

        // Encolar alertas si es nuevo o cambió status
        if (result.isNew || result.statusChanged) {
          const cpcCodes = extractCpcCodes(release);
          const ocpMethod = mapOcpMethodType(
            release.tender?.procurementMethod ?? "",
            release.tender?.procurementMethodDetails
          );

          await processAlertsQueue.add("process-alert", {
            processId: result.processId,
            ocid: release.ocid,
            cpcCodes,
            isNew: result.isNew,
            previousStatus: result.previousStatus,
            newStatus: result.newStatus,
            procurementMethod: release.tender?.procurementMethod ?? "unknown",
            ocpMethodType: ocpMethod,
          });
        }

        await job.updateProgress(Math.round((totalProcessed / allReleases.length) * 100));
      } catch (error) {
        errors++;
        console.error(`[Sync] Error procesando ${release.ocid}:`, error);
      }
    }

    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: errors > 0 ? "PARTIAL" : "COMPLETED",
        completedAt: new Date(),
        totalProcessed,
        newRecords,
        updatedRecords,
        errors,
        year: currentYear,
      },
    });

    console.log(
      `[Sync] Completado: ${totalProcessed} procesados, ${newRecords} nuevos, ${updatedRecords} actualizados, ${errors} errores`
    );
  } catch (error) {
    console.error("[Sync] Error fatal:", error);
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        totalProcessed,
        newRecords,
        updatedRecords,
        errors,
        errorDetails: { message: String(error) },
      },
    });
    throw error;
  }
}

async function handleBulkSync(job: Job<SyncJobData>) {
  const year = job.data.year ?? new Date().getFullYear();

  const syncLog = await prisma.syncLog.create({
    data: { status: "RUNNING", year },
  });

  let totalProcessed = 0;
  let newRecords = 0;
  let updatedRecords = 0;
  let errors = 0;

  try {
    const { releases } = await sercopClient.fetchBulkData(
      year,
      (page, totalPages, total) => {
        console.log(`[Bulk ${year}] Página ${page}/${totalPages} — ${total} procesos descargados`);
        job.updateProgress(Math.round((page / totalPages) * 100));
      }
    );

    for (const release of releases) {
      try {
        const result = await upsertProcess(release);
        totalProcessed++;
        if (result.isNew) newRecords++;
        else if (result.wasUpdated) updatedRecords++;
      } catch (error) {
        errors++;
        console.error(`[Bulk] Error procesando ${release.ocid}:`, error);
      }
    }

    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: errors > 0 ? "PARTIAL" : "COMPLETED",
        completedAt: new Date(),
        totalProcessed,
        newRecords,
        updatedRecords,
        errors,
        year,
      },
    });

    console.log(
      `[Bulk ${year}] Completado: ${totalProcessed} procesados, ${newRecords} nuevos, ${updatedRecords} actualizados, ${errors} errores`
    );
  } catch (error) {
    console.error(`[Bulk ${year}] Error fatal:`, error);
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        totalProcessed,
        newRecords,
        updatedRecords,
        errors,
        errorDetails: { message: String(error) },
      },
    });
    throw error;
  }
}

interface UpsertResult {
  processId: string;
  isNew: boolean;
  wasUpdated: boolean;
  statusChanged: boolean;
  previousStatus?: string;
  newStatus: string;
}

async function upsertProcess(release: OCDSRelease): Promise<UpsertResult> {
  const data = transformRelease(release);

  // Buscar si ya existe
  const existing = await prisma.procurementProcess.findUnique({
    where: { ocid: release.ocid },
    select: { id: true, status: true, updatedAt: true },
  });

  if (!existing) {
    const created = await prisma.procurementProcess.create({ data });

    // Crear awards si existen
    const awards = transformAwards(release, created.id);
    if (awards.length > 0) {
      await prisma.procurementAward.createMany({ data: awards });
    }

    return {
      processId: created.id,
      isNew: true,
      wasUpdated: false,
      statusChanged: false,
      newStatus: data.status,
    };
  }

  const statusChanged = existing.status !== data.status;

  // Actualizar el registro existente
  await prisma.procurementProcess.update({
    where: { ocid: release.ocid },
    data: {
      ...data,
      ocid: undefined, // No actualizar la PK
    },
  });

  // Actualizar awards
  const awards = transformAwards(release, existing.id);
  for (const award of awards) {
    await prisma.procurementAward.upsert({
      where: {
        processId_awardId: {
          processId: existing.id,
          awardId: award.awardId,
        },
      },
      create: award,
      update: award,
    });
  }

  return {
    processId: existing.id,
    isNew: false,
    wasUpdated: true,
    statusChanged,
    previousStatus: existing.status,
    newStatus: data.status,
  };
}

async function enqueueBulkLoad(year: number) {
  const { default: { Queue } } = await import("bullmq");
  const queue = new Queue("sercop-sync", { connection: redis });
  await queue.add("bulk-sync", { type: "bulk", year }, {
    jobId: `bulk-${year}`,
    attempts: 3,
    backoff: { type: "exponential", delay: 30_000 },
  });
  await queue.close();
}
