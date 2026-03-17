import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPlanLimits, cpcLimitError } from "@/lib/plan-guard";
import { SubscriptionPlan } from "@prisma/client";
import { z } from "zod";
import rawCpcCodes from "@/data/cpc-codes.json";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CpcEntry {
  code: string;
  description: string;
}

const CPC_CODES: CpcEntry[] = rawCpcCodes;

// ─── Schemas ──────────────────────────────────────────────────────────────────

const addCpcSchema = z.object({
  cpcCode: z.string().min(4).max(10),
  cpcDescription: z.string().optional(),
});

// ─── GET /api/cpc?q=<query> ───────────────────────────────────────────────────
// No auth required — used during onboarding before login.
// Supports searching by code prefix (e.g. "481") and by description keyword
// (e.g. "papel"). Returns up to 15 matches.

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("q")?.trim() ?? "";
  const query = raw.toLowerCase();

  // When no query or too short, return a diverse set of representative codes
  // spread across common procurement categories so the selector looks useful
  // before the user starts typing.
  if (query.length < 2) {
    const defaults: CpcEntry[] = [
      { code: "61110", description: "Servicios de construcción de edificios residenciales" },
      { code: "62010", description: "Servicios de desarrollo de software" },
      { code: "71121", description: "Servicios de ingeniería civil" },
      { code: "86110", description: "Servicios hospitalarios de internamiento" },
      { code: "46110", description: "Medicamentos para uso humano" },
      { code: "81210", description: "Servicios de limpieza de edificios e instalaciones" },
      { code: "82210", description: "Servicios de guardia y vigilancia privada armada" },
      { code: "80520", description: "Servicios de capacitación para adultos y empresas" },
      { code: "51200", description: "Servicios de transporte por carretera de mercancías" },
      { code: "48130", description: "Muebles escolares y universitarios" },
    ];
    return NextResponse.json({ results: defaults });
  }

  // Primary pass: exact code-prefix match (highest relevance for numeric input)
  const byCodePrefix = CPC_CODES.filter((cpc) =>
    cpc.code.startsWith(query)
  );

  // Secondary pass: substring match in code (handles mid-code input like "110")
  const byCodeSubstring = CPC_CODES.filter(
    (cpc) => !cpc.code.startsWith(query) && cpc.code.includes(query)
  );

  // Tertiary pass: keyword match in description (split on whitespace to allow
  // multi-word queries such as "servicios construcción")
  const keywords = query.split(/\s+/).filter((k) => k.length >= 2);
  const alreadyMatched = new Set(
    [...byCodePrefix, ...byCodeSubstring].map((c) => c.code)
  );
  const byDescription = CPC_CODES.filter((cpc) => {
    if (alreadyMatched.has(cpc.code)) return false;
    const desc = cpc.description.toLowerCase();
    return keywords.every((kw) => desc.includes(kw));
  });

  const results = [...byCodePrefix, ...byCodeSubstring, ...byDescription].slice(
    0,
    15
  );

  return NextResponse.json({ results });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = session.user as any;
  const orgId = user.orgId as string;
  const plan = user.plan as SubscriptionPlan;

  const body = await req.json().catch(() => ({}));
  const parsed = addCpcSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const limits = getPlanLimits(plan);
  const currentCount = await prisma.orgCpcCode.count({ where: { orgId } });
  if (currentCount >= limits.maxCpcCodes) {
    return cpcLimitError(plan);
  }

  const cpc = await prisma.orgCpcCode.create({
    data: { orgId, cpcCode: parsed.data.cpcCode, cpcDescription: parsed.data.cpcDescription ?? null },
  });

  return NextResponse.json(cpc, { status: 201 });
}
