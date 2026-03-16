import { Worker, type Job } from "bullmq";
import { prisma } from "../lib/prisma.js";
import { findMatchingOrganizations } from "../lib/cpc-matcher.js";
import { sendNotificationsQueue } from "./queues.js";
import type { redis } from "../lib/redis.js";

export interface ProcessAlertJobData {
  processId: string;
  ocid: string;
  cpcCodes: string[];
  isNew: boolean;
  previousStatus?: string;
  newStatus: string;
  procurementMethod: string;
  ocpMethodType?: string;
}

export function createProcessAlertsWorker(connection: typeof redis) {
  return new Worker<ProcessAlertJobData>(
    "process-alerts",
    async (job: Job<ProcessAlertJobData>) => {
      const {
        processId,
        ocid,
        cpcCodes,
        isNew,
        previousStatus,
        newStatus,
        ocpMethodType,
      } = job.data;

      // ⚠️ REGLA CRÍTICA: Ínfima Cuantía (DIRECT) NO genera alertas.
      // Solo se almacena en DB para analytics histórico.
      if (ocpMethodType === "DIRECT") {
        console.log(
          `[Alerts] Ignorando ${ocid}: método DIRECT (Ínfima Cuantía) — solo analytics`
        );
        return;
      }

      // Buscar organizaciones que hagan match por CPC
      const matches = await findMatchingOrganizations(cpcCodes, processId);

      if (matches.length === 0) {
        console.log(`[Alerts] ${ocid}: sin matches CPC`);
        return;
      }

      console.log(`[Alerts] ${ocid}: ${matches.length} matches encontrados`);

      // Cargar datos del proceso para el título de la alerta
      const process = await prisma.procurementProcess.findUnique({
        where: { id: processId },
        select: { title: true, buyerName: true, estimatedValue: true },
      });

      for (const match of matches) {
        let alertType: "NEW_PROCESS" | "STATUS_CHANGE";
        let title: string;
        let message: string;

        if (isNew) {
          alertType = "NEW_PROCESS";
          title = `Nuevo proceso: ${process?.title ?? ocid}`;
          message = `${process?.buyerName ?? "Entidad"} publicó un nuevo proceso que coincide con tu código CPC ${match.matchedCpcCode} (${match.matchType === "exact" ? "coincidencia exacta" : "categoría"}).`;
        } else {
          alertType = "STATUS_CHANGE";
          title = `Cambio de estado: ${process?.title ?? ocid}`;
          message = `El proceso cambió de ${previousStatus ?? "desconocido"} a ${newStatus}. Código CPC: ${match.matchedCpcCode}.`;
        }

        const alert = await prisma.alert.create({
          data: {
            orgId: match.orgId,
            processId,
            type: alertType,
            title,
            message,
            matchedCpc: match.matchedCpcCode,
            matchType: match.matchType,
          },
        });

        // Encolar notificación
        await sendNotificationsQueue.add("send-notification", {
          alertId: alert.id,
        });
      }

      // Verificar deadlines próximos para las orgs que hicieron match
      await checkDeadlineReminders(matches.map((m) => m.orgId), processId);
    },
    {
      connection,
      concurrency: 5,
      autorun: true,
    }
  );
}

async function checkDeadlineReminders(orgIds: string[], currentProcessId: string) {
  const uniqueOrgIds = [...new Set(orgIds)];
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

  for (const orgId of uniqueOrgIds) {
    // Buscar procesos trackeados por esta org que venzan en 3 días
    const expiringProcesses = await prisma.trackedProcess.findMany({
      where: {
        orgId,
        process: {
          tenderEndDate: {
            gte: new Date(),
            lte: threeDaysFromNow,
          },
          status: "TENDER",
        },
      },
      include: {
        process: { select: { id: true, title: true, tenderEndDate: true } },
      },
    });

    for (const tracked of expiringProcesses) {
      // Evitar alertas duplicadas de deadline
      const existingAlert = await prisma.alert.findFirst({
        where: {
          orgId,
          processId: tracked.processId,
          type: "DEADLINE_REMINDER",
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // últimas 24h
        },
      });

      if (existingAlert) continue;

      const alert = await prisma.alert.create({
        data: {
          orgId,
          processId: tracked.processId,
          type: "DEADLINE_REMINDER",
          title: `Fecha límite próxima: ${tracked.process.title}`,
          message: `El plazo de presentación vence el ${tracked.process.tenderEndDate?.toLocaleDateString("es-EC")}. ¡Quedan menos de 3 días!`,
        },
      });

      await sendNotificationsQueue.add("send-notification", {
        alertId: alert.id,
      });
    }
  }
}
