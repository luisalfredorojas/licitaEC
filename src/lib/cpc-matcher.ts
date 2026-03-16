import { prisma } from "./prisma.js";

export interface MatchResult {
  orgId: string;
  matchedCpcCode: string;
  matchType: "exact" | "category";
  processId?: string;
}

/**
 * Encuentra organizaciones cuyos códigos CPC registrados coinciden
 * con los códigos CPC de un proceso de contratación.
 *
 * Lógica de matching:
 * - CPC 9 dígitos del contrato → match exacto O match con categoría padre (5 dígitos)
 * - CPC 5 dígitos del contrato → solo match exacto
 */
export async function findMatchingOrganizations(
  cpcCodes: string[],
  processId?: string
): Promise<MatchResult[]> {
  if (cpcCodes.length === 0) return [];

  // Generar las categorías padre (primeros 5 dígitos) de códigos de 9 dígitos
  const exactCodes = cpcCodes;
  const categoryCodes = cpcCodes
    .filter((code) => code.length >= 9)
    .map((code) => code.substring(0, 5));

  // Todos los códigos a buscar (exactos + categorías padre)
  const allSearchCodes = [...new Set([...exactCodes, ...categoryCodes])];

  // Una sola query SQL eficiente con ANY() — busca orgs que tengan
  // al menos un código CPC que esté en nuestro set de búsqueda
  const matchingOrgs = await prisma.organization.findMany({
    where: {
      cpcCodes: {
        hasSome: allSearchCodes,
      },
    },
    select: {
      id: true,
      cpcCodes: true,
    },
  });

  const results: MatchResult[] = [];

  for (const org of matchingOrgs) {
    for (const orgCode of org.cpcCodes) {
      // Match exacto: el código de la org está directamente en los CPC del proceso
      if (exactCodes.includes(orgCode)) {
        results.push({
          orgId: org.id,
          matchedCpcCode: orgCode,
          matchType: "exact",
          processId,
        });
        continue;
      }

      // Match por categoría: la org tiene un código de 5 dígitos que es padre
      // de algún código de 9 dígitos del proceso
      if (orgCode.length === 5 && categoryCodes.includes(orgCode)) {
        results.push({
          orgId: org.id,
          matchedCpcCode: orgCode,
          matchType: "category",
          processId,
        });
      }
    }
  }

  return results;
}
