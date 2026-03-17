import { NextResponse } from "next/server"
import { SubscriptionPlan } from "@prisma/client"

// Feature matrix por plan
const PLAN_LIMITS = {
  BASIC: {
    maxCpcCodes: 5,
    maxUsers: 1,
    features: new Set(["dashboard", "contratos", "alertas"] as const),
  },
  PROFESSIONAL: {
    maxCpcCodes: Infinity,
    maxUsers: 3,
    features: new Set(["dashboard", "contratos", "alertas", "pipeline", "documents", "analytics"] as const),
  },
  ENTERPRISE: {
    maxCpcCodes: Infinity,
    maxUsers: Infinity,
    features: new Set([
      "dashboard",
      "contratos",
      "alertas",
      "pipeline",
      "documents",
      "analytics",
      "api",
    ] as const),
  },
} as const satisfies Record<SubscriptionPlan, { maxCpcCodes: number; maxUsers: number; features: ReadonlySet<string> }>

const PLAN_ORDER: SubscriptionPlan[] = ["BASIC", "PROFESSIONAL", "ENTERPRISE"]

function planRank(plan: SubscriptionPlan): number {
  return PLAN_ORDER.indexOf(plan)
}

/** Returns true if userPlan meets or exceeds minPlan */
export function hasPlan(userPlan: SubscriptionPlan, minPlan: SubscriptionPlan): boolean {
  return planRank(userPlan) >= planRank(minPlan)
}

/** Throws a 403 NextResponse if plan is insufficient */
export function requirePlan(userPlan: SubscriptionPlan, minPlan: SubscriptionPlan): void {
  if (!hasPlan(userPlan, minPlan)) {
    throw planError(minPlan)
  }
}

/** Returns a 403 NextResponse with upgrade message */
export function planError(minPlan: SubscriptionPlan) {
  const names: Record<SubscriptionPlan, string> = {
    BASIC: "Básico",
    PROFESSIONAL: "Profesional",
    ENTERPRISE: "Empresa",
  }
  return NextResponse.json(
    {
      error: `Esta función requiere el plan ${names[minPlan]}. Actualiza tu plan en Configuración.`,
      upgradeRequired: true,
      requiredPlan: minPlan,
    },
    { status: 403 }
  )
}

/** Returns a 403 NextResponse for CPC limit exceeded */
export function cpcLimitError(plan: SubscriptionPlan) {
  const limit = PLAN_LIMITS[plan].maxCpcCodes
  return NextResponse.json(
    {
      error: `Tu plan permite un máximo de ${limit} códigos CPC. Actualiza tu plan para agregar más.`,
      upgradeRequired: true,
      limit,
    },
    { status: 403 }
  )
}

/** Returns a 403 NextResponse for user limit exceeded */
export function userLimitError(plan: SubscriptionPlan) {
  const limit = PLAN_LIMITS[plan].maxUsers
  return NextResponse.json(
    {
      error: `Tu plan permite un máximo de ${limit} usuario${limit === 1 ? "" : "s"}. Actualiza tu plan para invitar más.`,
      upgradeRequired: true,
      limit,
    },
    { status: 403 }
  )
}

export function getPlanLimits(plan: SubscriptionPlan) {
  return PLAN_LIMITS[plan]
}

export { PLAN_LIMITS }
