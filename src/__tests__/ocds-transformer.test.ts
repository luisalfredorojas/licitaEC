import { describe, it, expect } from "vitest";
import {
  mapStatus,
  mapOcpMethodType,
  extractCpcCodes,
  transformRelease,
} from "../lib/ocds-transformer.js";
import type { OCDSRelease } from "../types/ocds.js";

// ─── Helpers ─────────────────────────────────────────

function makeRelease(overrides: Partial<OCDSRelease> = {}): OCDSRelease {
  return {
    ocid: "ocds-abc-001",
    id: "release-001",
    date: "2025-03-15T10:00:00Z",
    tag: ["tender"],
    initiationType: "tender",
    language: "es",
    buyer: {
      name: "GAD Municipal de Quito",
      id: "EC-RUC-1760001550001",
      address: { region: "Pichincha", locality: "Quito", countryName: "Ecuador" },
    },
    tender: {
      id: "tender-001",
      title: "Adquisición de equipos informáticos",
      description: "Compra de laptops y monitores para la institución",
      status: "active",
      procurementMethod: "open",
      procurementMethodDetails: "Subasta Inversa Electrónica",
      value: { amount: 150000, currency: "USD" },
      tenderPeriod: {
        startDate: "2025-03-15T00:00:00Z",
        endDate: "2025-04-15T23:59:59Z",
      },
      items: [
        {
          id: "item-1",
          description: "Laptops",
          classification: { scheme: "CPC", id: "452310000", description: "Computadoras portátiles" },
          additionalClassifications: [
            { scheme: "CPC", id: "45231", description: "Equipos informáticos" },
          ],
          quantity: 50,
          unit: { name: "unidad" },
        },
      ],
      numberOfTenderers: 3,
    },
    ...overrides,
  };
}

// ─── mapStatus ───────────────────────────────────────

describe("mapStatus", () => {
  it("mapea status OCDS básicos", () => {
    expect(mapStatus("planning", [])).toBe("PLANNING");
    expect(mapStatus("active", [])).toBe("TENDER");
    expect(mapStatus("complete", [])).toBe("AWARD");
    expect(mapStatus("awarded", [])).toBe("CONTRACT");
    expect(mapStatus("cancelled", [])).toBe("CANCELLED");
  });

  it("los tags tienen prioridad sobre el status", () => {
    expect(mapStatus("active", ["award"])).toBe("AWARD");
    expect(mapStatus("active", ["contract"])).toBe("CONTRACT");
    expect(mapStatus("active", ["tenderCancellation"])).toBe("CANCELLED");
  });

  it("devuelve PLANNING para status desconocido", () => {
    expect(mapStatus("unknown_status", [])).toBe("PLANNING");
  });

  it("maneja tags de terminación de contrato", () => {
    expect(mapStatus("complete", ["contractTermination"])).toBe("CLOSED");
  });
});

// ─── mapOcpMethodType ────────────────────────────────

describe("mapOcpMethodType", () => {
  it("mapea métodos OCDS estándar", () => {
    expect(mapOcpMethodType("open")).toBe("OPEN");
    expect(mapOcpMethodType("selective")).toBe("SELECTIVE");
    expect(mapOcpMethodType("limited")).toBe("LIMITED");
    expect(mapOcpMethodType("direct")).toBe("DIRECT");
  });

  it("mapea por detalles del método ecuatoriano", () => {
    expect(mapOcpMethodType("open", "Subasta Inversa Electrónica")).toBe("OPEN");
    expect(mapOcpMethodType("open", "Licitación")).toBe("OPEN");
    expect(mapOcpMethodType("open", "Cotización")).toBe("OPEN");
    expect(mapOcpMethodType("selective", "Menor Cuantía")).toBe("SELECTIVE");
    expect(mapOcpMethodType("limited", "Consultoría – Lista Corta")).toBe("LIMITED");
    expect(mapOcpMethodType("direct", "Ínfima Cuantía")).toBe("DIRECT");
  });

  it("retorna undefined para métodos desconocidos", () => {
    expect(mapOcpMethodType("xyz_method")).toBeUndefined();
  });

  it("es case-insensitive en los detalles", () => {
    expect(mapOcpMethodType("", "subasta inversa electrónica")).toBe("OPEN");
    expect(mapOcpMethodType("", "MENOR CUANTÍA")).toBe("SELECTIVE");
  });
});

// ─── extractCpcCodes ─────────────────────────────────

describe("extractCpcCodes", () => {
  it("extrae códigos CPC de tender.items", () => {
    const release = makeRelease();
    const codes = extractCpcCodes(release);
    expect(codes).toContain("452310000");
    expect(codes).toContain("45231");
  });

  it("extrae códigos CPC de awards.items", () => {
    const release = makeRelease({
      awards: [
        {
          id: "award-1",
          status: "active",
          items: [
            {
              id: "item-a",
              description: "Servidores",
              classification: { scheme: "CPC", id: "452320000", description: "Servidores" },
            },
          ],
        },
      ],
    });
    const codes = extractCpcCodes(release);
    expect(codes).toContain("452320000");
  });

  it("devuelve array vacío sin items", () => {
    const release = makeRelease({ tender: { ...makeRelease().tender!, items: [] } });
    const codes = extractCpcCodes(release);
    // Solo tiene additionalClassifications del release original que ahora no existen
    expect(codes.length).toBe(0);
  });

  it("ignora clasificaciones que no son CPC", () => {
    const release = makeRelease({
      tender: {
        ...makeRelease().tender!,
        items: [
          {
            id: "item-x",
            description: "Algo",
            classification: { scheme: "UNSPSC", id: "43211500", description: "Computers" },
          },
        ],
      },
    });
    const codes = extractCpcCodes(release);
    expect(codes).not.toContain("43211500");
  });

  it("elimina duplicados", () => {
    const release = makeRelease({
      tender: {
        ...makeRelease().tender!,
        items: [
          {
            id: "item-1",
            description: "A",
            classification: { scheme: "CPC", id: "45231", description: "Cat" },
          },
          {
            id: "item-2",
            description: "B",
            classification: { scheme: "CPC", id: "45231", description: "Cat" },
          },
        ],
      },
    });
    const codes = extractCpcCodes(release);
    expect(codes.filter((c) => c === "45231")).toHaveLength(1);
  });
});

// ─── transformRelease ────────────────────────────────

describe("transformRelease", () => {
  it("transforma un release completo correctamente", () => {
    const release = makeRelease();
    const result = transformRelease(release);

    expect(result.ocid).toBe("ocds-abc-001");
    expect(result.title).toBe("Adquisición de equipos informáticos");
    expect(result.status).toBe("TENDER");
    expect(result.procurementMethod).toBe("open");
    expect(result.ocpMethodType).toBe("OPEN");
    expect(result.buyerName).toBe("GAD Municipal de Quito");
    expect(result.buyerRegion).toBe("Pichincha");
    expect(result.buyerLocality).toBe("Quito");
    expect(result.estimatedValue).toBe(150000);
    expect(result.currency).toBe("USD");
    expect(result.cpcCodes).toContain("452310000");
    expect(result.numberOfTenderers).toBe(3);
  });

  it("sanitiza HTML en descripción", () => {
    const release = makeRelease({
      tender: {
        ...makeRelease().tender!,
        description: "<p>Texto con <b>HTML</b></p>",
      },
    });
    const result = transformRelease(release);
    expect(result.description).toBe("Texto con HTML");
  });

  it("trunca descripción a 5000 chars", () => {
    const longDesc = "A".repeat(6000);
    const release = makeRelease({
      tender: { ...makeRelease().tender!, description: longDesc },
    });
    const result = transformRelease(release);
    expect((result.description as string).length).toBe(5000);
  });

  it("usa release.id como título si no hay tender.title", () => {
    const release = makeRelease({
      tender: { ...makeRelease().tender!, title: undefined as unknown as string },
    });
    // Forzar que title sea undefined
    (release.tender as Record<string, unknown>).title = undefined;
    const result = transformRelease(release);
    expect(result.title).toBe("release-001");
  });

  it("extrae datos del primer award", () => {
    const release = makeRelease({
      awards: [
        {
          id: "award-1",
          status: "active",
          value: { amount: 120000, currency: "USD" },
          date: "2025-04-20T00:00:00Z",
          suppliers: [{ name: "Tech Corp S.A.", id: "EC-RUC-1791234560001" }],
        },
      ],
    });
    const result = transformRelease(release);
    expect(result.awardedValue).toBe(120000);
    expect(result.awardDate).toBeInstanceOf(Date);
  });

  it("maneja release mínimo sin tender", () => {
    const release: OCDSRelease = {
      ocid: "ocds-min-001",
      id: "min-001",
      date: "2025-01-01T00:00:00Z",
      tag: ["planning"],
      initiationType: "tender",
      language: "es",
      buyer: { name: "Entidad X", id: "EC-001" },
    };
    const result = transformRelease(release);
    expect(result.ocid).toBe("ocds-min-001");
    expect(result.status).toBe("PLANNING");
    expect(result.procurementMethod).toBe("unknown");
  });
});
