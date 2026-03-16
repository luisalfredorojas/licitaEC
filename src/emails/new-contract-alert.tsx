import type { AlertType } from "@prisma/client";

interface NewContractAlertProps {
  processTitle: string;
  buyerName: string;
  estimatedValue?: number;
  currency: string;
  tenderEndDate?: Date;
  matchedCpc?: string;
  alertType: AlertType;
  alertMessage?: string;
  processUrl: string;
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency,
  }).format(amount);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("es-EC", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function isDeadlineSoon(date: Date): boolean {
  const threeDays = 3 * 24 * 60 * 60 * 1000;
  return date.getTime() - Date.now() < threeDays && date.getTime() > Date.now();
}

function getAlertTitle(alertType: AlertType): string {
  switch (alertType) {
    case "NEW_PROCESS":
      return "Nuevo contrato que coincide con tu empresa";
    case "STATUS_CHANGE":
      return "Actualización de proceso";
    case "DEADLINE_REMINDER":
      return "Fecha límite próxima";
    default:
      return "Notificación de contrato";
  }
}

export function renderNewContractAlert(props: NewContractAlertProps): string {
  const {
    processTitle,
    buyerName,
    estimatedValue,
    currency,
    tenderEndDate,
    matchedCpc,
    alertType,
    alertMessage,
    processUrl,
  } = props;

  const deadlineSoon = tenderEndDate ? isDeadlineSoon(tenderEndDate) : false;
  const alertTitle = getAlertTitle(alertType);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${alertTitle}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #18181b; padding: 24px 32px;">
              <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700;">LicitaEC</h1>
            </td>
          </tr>

          <!-- Alert title -->
          <tr>
            <td style="padding: 32px 32px 16px;">
              <h2 style="margin: 0; color: #18181b; font-size: 18px; font-weight: 600;">
                ${alertTitle}
              </h2>
            </td>
          </tr>

          ${alertMessage ? `
          <tr>
            <td style="padding: 0 32px 16px;">
              <p style="margin: 0; color: #52525b; font-size: 14px; line-height: 1.5;">
                ${alertMessage}
              </p>
            </td>
          </tr>
          ` : ""}

          <!-- Process details -->
          <tr>
            <td style="padding: 0 32px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fafafa; border-radius: 6px; border: 1px solid #e4e4e7;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 12px; color: #71717a; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
                      Proceso
                    </p>
                    <p style="margin: 0 0 16px; color: #18181b; font-size: 16px; font-weight: 600; line-height: 1.4;">
                      ${processTitle}
                    </p>

                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 6px 0;">
                          <span style="color: #71717a; font-size: 13px;">Entidad contratante:</span>
                        </td>
                        <td style="padding: 6px 0; text-align: right;">
                          <span style="color: #18181b; font-size: 13px; font-weight: 500;">${buyerName}</span>
                        </td>
                      </tr>
                      ${estimatedValue !== undefined ? `
                      <tr>
                        <td style="padding: 6px 0;">
                          <span style="color: #71717a; font-size: 13px;">Monto estimado:</span>
                        </td>
                        <td style="padding: 6px 0; text-align: right;">
                          <span style="color: #18181b; font-size: 13px; font-weight: 500;">${formatCurrency(estimatedValue, currency)}</span>
                        </td>
                      </tr>
                      ` : ""}
                      ${tenderEndDate ? `
                      <tr>
                        <td style="padding: 6px 0;">
                          <span style="color: #71717a; font-size: 13px;">Fecha límite:</span>
                        </td>
                        <td style="padding: 6px 0; text-align: right;">
                          <span style="color: ${deadlineSoon ? "#dc2626" : "#18181b"}; font-size: 13px; font-weight: ${deadlineSoon ? "700" : "500"};">
                            ${formatDate(tenderEndDate)}${deadlineSoon ? " ⚠️" : ""}
                          </span>
                        </td>
                      </tr>
                      ` : ""}
                      ${matchedCpc ? `
                      <tr>
                        <td style="padding: 6px 0;">
                          <span style="color: #71717a; font-size: 13px;">Código CPC:</span>
                        </td>
                        <td style="padding: 6px 0; text-align: right;">
                          <span style="color: #18181b; font-size: 13px; font-weight: 500;">${matchedCpc}</span>
                        </td>
                      </tr>
                      ` : ""}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${deadlineSoon ? `
          <!-- Deadline warning -->
          <tr>
            <td style="padding: 0 32px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef2f2; border-radius: 6px; border: 1px solid #fecaca;">
                <tr>
                  <td style="padding: 12px 16px;">
                    <p style="margin: 0; color: #dc2626; font-size: 13px; font-weight: 600;">
                      La fecha de presentación vence en menos de 3 días. ¡No pierdas esta oportunidad!
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ""}

          <!-- CTA Button -->
          <tr>
            <td style="padding: 0 32px 32px;" align="center">
              <a href="${processUrl}" style="display: inline-block; background-color: #18181b; color: #ffffff; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 600;">
                Ver contrato completo
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0; color: #a1a1aa; font-size: 12px; text-align: center; line-height: 1.5;">
                Recibes este email porque tu empresa tiene alertas configuradas en LicitaEC.
                <br />
                <a href="${processUrl.split("/dashboard")[0]}/dashboard/configuracion" style="color: #71717a; text-decoration: underline;">
                  Configurar notificaciones
                </a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
