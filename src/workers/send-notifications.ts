import { Worker, type Job } from "bullmq";
import { Resend } from "resend";
import { prisma } from "../lib/prisma.js";
import { renderNewContractAlert } from "../emails/new-contract-alert.js";
import type { redis } from "../lib/redis.js";

export interface SendNotificationJobData {
  alertId: string;
}

const resend = new Resend(process.env.RESEND_API_KEY);

export function createSendNotificationsWorker(connection: typeof redis) {
  return new Worker<SendNotificationJobData>(
    "send-notifications",
    async (job: Job<SendNotificationJobData>) => {
      const { alertId } = job.data;

      const alert = await prisma.alert.findUnique({
        where: { id: alertId },
        include: {
          org: true,
          process: true,
        },
      });

      if (!alert) {
        console.warn(`[Notifications] Alert ${alertId} no encontrada`);
        return;
      }

      // Obtener usuarios de la org con notificaciones activas
      const users = await prisma.user.findMany({
        where: {
          orgId: alert.orgId,
          notificationsActive: true,
        },
        select: { email: true, name: true },
      });

      if (users.length === 0) {
        console.log(`[Notifications] Org ${alert.orgId}: sin usuarios con notificaciones activas`);
        await prisma.alert.update({
          where: { id: alertId },
          data: { notifiedAt: new Date() },
        });
        return;
      }

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const processUrl = `${appUrl}/dashboard/procesos/${alert.process.ocid}`;

      // Renderizar email
      const emailHtml = renderNewContractAlert({
        processTitle: alert.process.title,
        buyerName: alert.process.buyerName,
        estimatedValue: alert.process.estimatedValue
          ? Number(alert.process.estimatedValue)
          : undefined,
        currency: alert.process.currency,
        tenderEndDate: alert.process.tenderEndDate ?? undefined,
        matchedCpc: alert.matchedCpc ?? undefined,
        alertType: alert.type,
        alertMessage: alert.message ?? undefined,
        processUrl,
      });

      // Enviar a todos los usuarios
      const emails = users.map((u) => u.email);

      try {
        await resend.emails.send({
          from: "LicitaEC <alertas@licitaec.com>",
          to: emails,
          subject: alert.title,
          html: emailHtml,
        });

        console.log(
          `[Notifications] Email enviado para alert ${alertId} a ${emails.length} destinatarios`
        );
      } catch (error) {
        console.error(`[Notifications] Error enviando email:`, error);
        throw error; // BullMQ reintentará
      }

      // Marcar como notificada
      await prisma.alert.update({
        where: { id: alertId },
        data: { notifiedAt: new Date() },
      });
    },
    {
      connection,
      concurrency: 10,
      autorun: true,
    }
  );
}
