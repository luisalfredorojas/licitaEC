import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const registerSchema = z.object({
  nombre: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  nombreEmpresa: z.string().min(2),
  ruc: z.string().regex(/^\d{10}(\d{3})?$/),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { nombre, email, password, nombreEmpresa, ruc } = parsed.data;

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: "Ya existe una cuenta con este email" },
        { status: 409 }
      );
    }

    // Check if RUC already exists
    const existingOrg = await prisma.organization.findUnique({ where: { ruc } });
    if (existingOrg) {
      return NextResponse.json(
        { error: "Ya existe una empresa registrada con este RUC" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: nombreEmpresa,
          ruc,
          plan: "BASIC",
          subscriptionStatus: "trialing",
          trialEndsAt,
        },
      });

      await tx.user.create({
        data: {
          orgId: org.id,
          email,
          name: nombre,
          passwordHash,
          role: "ADMIN",
        },
      });
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
