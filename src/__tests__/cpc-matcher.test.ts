import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma antes de importar el módulo
vi.mock("../lib/prisma.js", () => ({
  prisma: {
    organization: {
      findMany: vi.fn(),
    },
  },
}));

import { findMatchingOrganizations } from "../lib/cpc-matcher.js";
import { prisma } from "../lib/prisma.js";

const mockFindMany = vi.mocked(prisma.organization.findMany);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("findMatchingOrganizations", () => {
  it("devuelve array vacío para códigos vacíos", async () => {
    const results = await findMatchingOrganizations([]);
    expect(results).toEqual([]);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it("encuentra match exacto con código de 9 dígitos", async () => {
    mockFindMany.mockResolvedValue([
      { id: "org-1", cpcCodes: ["452310000"] },
    ] as ReturnType<typeof mockFindMany> extends Promise<infer T> ? T : never);

    const results = await findMatchingOrganizations(["452310000"]);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      orgId: "org-1",
      matchedCpcCode: "452310000",
      matchType: "exact",
      processId: undefined,
    });
  });

  it("encuentra match por categoría padre (5 dígitos) para código de 9 dígitos", async () => {
    mockFindMany.mockResolvedValue([
      { id: "org-2", cpcCodes: ["45231"] },
    ] as ReturnType<typeof mockFindMany> extends Promise<infer T> ? T : never);

    const results = await findMatchingOrganizations(["452310000"]);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      orgId: "org-2",
      matchedCpcCode: "45231",
      matchType: "category",
      processId: undefined,
    });
  });

  it("encuentra ambos tipos de match para la misma org", async () => {
    mockFindMany.mockResolvedValue([
      { id: "org-3", cpcCodes: ["452310000", "45231"] },
    ] as ReturnType<typeof mockFindMany> extends Promise<infer T> ? T : never);

    const results = await findMatchingOrganizations(["452310000"]);

    expect(results).toHaveLength(2);
    expect(results.find((r) => r.matchType === "exact")).toBeTruthy();
    expect(results.find((r) => r.matchType === "category")).toBeTruthy();
  });

  it("incluye processId cuando se proporciona", async () => {
    mockFindMany.mockResolvedValue([
      { id: "org-1", cpcCodes: ["45231"] },
    ] as ReturnType<typeof mockFindMany> extends Promise<infer T> ? T : never);

    const results = await findMatchingOrganizations(["452310000"], "proc-123");

    expect(results[0]?.processId).toBe("proc-123");
  });

  it("busca múltiples códigos CPC a la vez", async () => {
    mockFindMany.mockResolvedValue([
      { id: "org-1", cpcCodes: ["45231"] },
      { id: "org-2", cpcCodes: ["34100"] },
    ] as ReturnType<typeof mockFindMany> extends Promise<infer T> ? T : never);

    const results = await findMatchingOrganizations(["452310000", "341000001"]);

    expect(results.length).toBeGreaterThanOrEqual(2);
  });

  it("usa hasSome para query eficiente", async () => {
    mockFindMany.mockResolvedValue([]);

    await findMatchingOrganizations(["452310000"]);

    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        cpcCodes: {
          hasSome: expect.arrayContaining(["452310000", "45231"]),
        },
      },
      select: {
        id: true,
        cpcCodes: true,
      },
    });
  });

  it("no genera categoría padre para código de 5 dígitos", async () => {
    mockFindMany.mockResolvedValue([
      { id: "org-1", cpcCodes: ["45231"] },
    ] as ReturnType<typeof mockFindMany> extends Promise<infer T> ? T : never);

    const results = await findMatchingOrganizations(["45231"]);

    // Solo match exacto, no por categoría
    expect(results).toHaveLength(1);
    expect(results[0]?.matchType).toBe("exact");
  });

  it("no duplica códigos en la búsqueda", async () => {
    mockFindMany.mockResolvedValue([]);

    await findMatchingOrganizations(["452310000", "452310001"]);

    // Ambos generan la misma categoría padre "45231"
    const call = mockFindMany.mock.calls[0]?.[0];
    const searchCodes = (call as { where: { cpcCodes: { hasSome: string[] } } }).where.cpcCodes.hasSome;
    const uniqueCodes = [...new Set(searchCodes)];
    expect(searchCodes.length).toBe(uniqueCodes.length);
  });
});
