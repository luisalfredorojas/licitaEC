import type { Prisma } from "@prisma/client";
import type { OCDSRelease } from "../types/ocds.js";

// ─── Mapeo de status OCDS → enum interno ──────────────

type ProcurementStatus = "PLANNING" | "TENDER" | "AWARD" | "CONTRACT" | "CLOSED" | "CANCELLED";
type OcpMethodType = "OPEN" | "SELECTIVE" | "LIMITED" | "DIRECT";

const STATUS_MAP: Record<string, ProcurementStatus> = {
  planning: "PLANNING",
  planned: "PLANNING",
  active: "TENDER",
  complete: "AWARD",
  awarded: "CONTRACT",
  cancelled: "CANCELLED",
  unsuccessful: "CANCELLED",
  closed: "CLOSED",
};

const TAG_STATUS_OVERRIDES: Record<string, ProcurementStatus> = {
  planning: "PLANNING",
  tender: "TENDER",
  tenderAmendment: "TENDER",
  tenderUpdate: "TENDER",
  tenderCancellation: "CANCELLED",
  award: "AWARD",
  awardUpdate: "AWARD",
  awardCancellation: "CANCELLED",
  contract: "CONTRACT",
  contractUpdate: "CONTRACT",
  contractTermination: "CLOSED",
};

// Mapeo de procurementMethod OCDS → tipo OCP
const METHOD_TYPE_MAP: Record<string, OcpMethodType> = {
  open: "OPEN",
  selective: "SELECTIVE",
  limited: "LIMITED",
  direct: "DIRECT",
};

// Métodos ecuatorianos específicos y su mapeo
const PROCUREMENT_METHOD_DETAILS_MAP: Record<string, OcpMethodType> = {
  "subasta inversa electrónica": "OPEN",
  "subasta inversa electronica": "OPEN",
  licitación: "OPEN",
  licitacion: "OPEN",
  cotización: "OPEN",
  cotizacion: "OPEN",
  "menor cuantía": "SELECTIVE",
  "menor cuantia": "SELECTIVE",
  "lista corta": "LIMITED",
  "consultoría": "LIMITED",
  consultoria: "LIMITED",
  "ínfima cuantía": "DIRECT",
  "infima cuantia": "DIRECT",
};

export function mapStatus(ocdsStatus: string, ocdsTag: string[]): ProcurementStatus {
  // Los tags más recientes tienen prioridad sobre el status genérico
  for (const tag of ocdsTag) {
    const override = TAG_STATUS_OVERRIDES[tag];
    if (override) return override;
  }

  return STATUS_MAP[ocdsStatus.toLowerCase()] ?? "PLANNING";
}

export function mapOcpMethodType(
  procurementMethod: string,
  procurementMethodDetails?: string
): OcpMethodType | undefined {
  // Primero intentar por el method estándar OCDS
  const byMethod = METHOD_TYPE_MAP[procurementMethod.toLowerCase()];
  if (byMethod) return byMethod;

  // Luego intentar por detalles específicos ecuatorianos
  if (procurementMethodDetails) {
    const normalized = procurementMethodDetails.toLowerCase().trim();
    for (const [key, value] of Object.entries(PROCUREMENT_METHOD_DETAILS_MAP)) {
      if (normalized.includes(key)) return value;
    }
  }

  return undefined;
}

export function extractCpcCodes(release: OCDSRelease): string[] {
  const codes = new Set<string>();

  const items = [
    ...(release.tender?.items ?? []),
    ...(release.awards?.flatMap((a) => a.items ?? []) ?? []),
  ];

  for (const item of items) {
    // Clasificación principal
    if (item.classification?.scheme?.toUpperCase() === "CPC" && item.classification.id) {
      codes.add(item.classification.id);
    }

    // Clasificaciones adicionales
    if (item.additionalClassifications) {
      for (const cls of item.additionalClassifications) {
        if (cls.scheme?.toUpperCase() === "CPC" && cls.id) {
          codes.add(cls.id);
        }
      }
    }
  }

  return Array.from(codes);
}

function sanitizeText(text: string | undefined | null, maxLength: number = 5000): string | undefined {
  if (!text) return undefined;

  let sanitized = text
    .replace(/<[^>]*>/g, "") // eliminar HTML
    .trim();

  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized || undefined;
}

export function transformRelease(
  release: OCDSRelease
): Prisma.ProcurementProcessCreateInput {
  const tender = release.tender;
  const cpcCodes = extractCpcCodes(release);
  const status = mapStatus(tender?.status ?? "", release.tag);
  const ocpMethodType = mapOcpMethodType(
    tender?.procurementMethod ?? "",
    tender?.procurementMethodDetails
  );

  const firstAward = release.awards?.[0];

  return {
    ocid: release.ocid,
    title: tender?.title ?? release.id,
    description: sanitizeText(tender?.description),
    status,
    procurementMethod: tender?.procurementMethod ?? "unknown",
    procurementMethodDetails: tender?.procurementMethodDetails,
    ocpMethodType,

    buyerName: release.buyer.name,
    buyerId: release.buyer.id,
    buyerRegion: release.buyer.address?.region,
    buyerLocality: release.buyer.address?.locality,

    estimatedValue: tender?.value?.amount,
    currency: tender?.value?.currency ?? "USD",
    awardedValue: firstAward?.value?.amount,

    tenderStartDate: tender?.tenderPeriod?.startDate
      ? new Date(tender.tenderPeriod.startDate)
      : undefined,
    tenderEndDate: tender?.tenderPeriod?.endDate
      ? new Date(tender.tenderPeriod.endDate)
      : undefined,
    enquiryEndDate: tender?.enquiryPeriod?.endDate
      ? new Date(tender.enquiryPeriod.endDate)
      : undefined,
    awardDate: firstAward?.date ? new Date(firstAward.date) : undefined,

    cpcCodes,
    numberOfTenderers: tender?.numberOfTenderers,
    rawOcdsData: release as unknown as Prisma.InputJsonValue,
    publishedDate: new Date(release.date),
    lastUpdatedFromSource: new Date(),
  };
}

export function transformAwards(
  release: OCDSRelease,
  processId: string
): Prisma.ProcurementAwardCreateManyInput[] {
  if (!release.awards) return [];

  return release.awards.map((award) => ({
    processId,
    awardId: award.id,
    title: award.title,
    status: award.status,
    value: award.value?.amount,
    currency: award.value?.currency ?? "USD",
    awardDate: award.date ? new Date(award.date) : undefined,
    supplierName: award.suppliers?.[0]?.name,
    supplierId: award.suppliers?.[0]?.id,
  }));
}
