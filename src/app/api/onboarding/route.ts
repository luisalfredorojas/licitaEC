import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const onboardingSchema = z.object({
  nombreEmpresa: z.string().min(2),
  ruc: z.string().regex(/^\d{10}(\d{3})?$/),
  rupCode: z.string().nullable().optional(),
  cpcCodes: z.array(
    z.object({
      code: z.string().max(10),
      description: z.string(),
    })
  ),
  plan: z.enum(["BASIC", "PROFESSIONAL", "ENTERPRISE"]),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const orgId = (session.user as { orgId: string }).orgId;
  if (!orgId) {
    return NextResponse.json({ error: "Organización no encontrada" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const parsed = onboardingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { nombreEmpresa, ruc, rupCode, cpcCodes, plan } = parsed.data;

    await prisma.$transaction(async (tx) => {
      // Update organization
      await tx.organization.update({
        where: { id: orgId },
        data: {
          name: nombreEmpresa,
          ruc,
          rupCode: rupCode ?? undefined,
          plan,
        },
      });

      // Replace CPC codes
      await tx.orgCpcCode.deleteMany({ where: { orgId } });

      if (cpcCodes.length > 0) {
        await tx.orgCpcCode.createMany({
          data: cpcCodes.map((cpc) => ({
            orgId,
            cpcCode: cpc.code,
            cpcDescription: cpc.description,
          })),
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Onboarding error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
