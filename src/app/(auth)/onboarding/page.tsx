"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CpcSelector } from "@/components/onboarding/CpcSelector";
import {
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Building2,
  Tag,
  CreditCard,
  Loader2,
} from "lucide-react";

interface CpcCode {
  code: string;
  description: string;
}

// ─── Step 1 Schema ───────────────────────────────────────────────────────────
const step1Schema = z.object({
  nombreEmpresa: z.string().min(2, "Nombre de empresa requerido"),
  ruc: z.string().regex(/^\d{10}(\d{3})?$/, "RUC debe ser de 10 o 13 dígitos"),
  rupCode: z.string().optional(),
});

type Step1Form = z.infer<typeof step1Schema>;

// ─── Plan config ─────────────────────────────────────────────────────────────
const PLANS = [
  {
    id: "BASIC",
    name: "Básico",
    price: "$29/mes",
    features: ["Alertas email", "5 códigos CPC", "1 usuario"],
    highlighted: false,
  },
  {
    id: "PROFESSIONAL",
    name: "Profesional",
    price: "$79/mes",
    features: ["Alertas tiempo real", "CPC ilimitados", "3 usuarios", "Analytics"],
    highlighted: true,
  },
  {
    id: "ENTERPRISE",
    name: "Empresa",
    price: "$199/mes",
    features: ["Todo Profesional", "Gestión documental", "API propia", "Ilimitados"],
    highlighted: false,
  },
];

// ─── Step indicators ─────────────────────────────────────────────────────────
const STEPS = [
  { label: "Tu empresa", icon: Building2 },
  { label: "Actividades", icon: Tag },
  { label: "Plan", icon: CreditCard },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedCpcs, setSelectedCpcs] = useState<CpcCode[]>([]);
  const [selectedPlan, setSelectedPlan] = useState("PROFESSIONAL");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
  } = useForm<Step1Form>({
    resolver: zodResolver(step1Schema),
  });

  async function handleStep1(data: Step1Form) {
    // Save to session/server — for now just advance
    void data;
    setCurrentStep(1);
  }

  function handleStep2() {
    if (selectedCpcs.length === 0) {
      setError("Selecciona al menos un código CPC");
      return;
    }
    setError(null);
    setCurrentStep(2);
  }

  async function handleFinish() {
    setSaving(true);
    setError(null);
    try {
      const step1Data = getValues();
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombreEmpresa: step1Data.nombreEmpresa,
          ruc: step1Data.ruc,
          rupCode: step1Data.rupCode ?? null,
          cpcCodes: selectedCpcs,
          plan: selectedPlan,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? "Error al guardar configuración");
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Error de conexión. Por favor intenta nuevamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full max-w-2xl">
      {/* Step indicators */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const isCompleted = i < currentStep;
          const isCurrent = i === currentStep;
          return (
            <div key={step.label} className="flex items-center gap-2">
              <div
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  isCurrent
                    ? "bg-[#1E40AF] text-white"
                    : isCompleted
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {isCompleted ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
                {step.label}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`w-8 h-0.5 ${isCompleted ? "bg-green-300" : "bg-gray-200"}`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step 1: Company data */}
      {currentStep === 0 && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Datos de tu empresa</CardTitle>
            <CardDescription>
              Confirma o actualiza la información de tu empresa
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(handleStep1)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="nombreEmpresa">Nombre de empresa</Label>
                <Input
                  id="nombreEmpresa"
                  placeholder="Mi Empresa S.A."
                  {...register("nombreEmpresa")}
                />
                {errors.nombreEmpresa && (
                  <p className="text-xs text-red-600">{errors.nombreEmpresa.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ruc">RUC</Label>
                <Input
                  id="ruc"
                  placeholder="1790012345001"
                  maxLength={13}
                  {...register("ruc")}
                />
                {errors.ruc && (
                  <p className="text-xs text-red-600">{errors.ruc.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="rupCode">
                  Código RUP{" "}
                  <span className="text-gray-400 font-normal">(opcional)</span>
                </Label>
                <Input
                  id="rupCode"
                  placeholder="Tu código de Registro Único de Proveedores"
                  {...register("rupCode")}
                />
                <p className="text-xs text-gray-500">
                  El RUP es tu habilitación para licitar en el SERCOP. Puedes agregarlo después.
                </p>
              </div>

              <Button type="submit" className="w-full gap-2 mt-2">
                Continuar
                <ArrowRight className="w-4 h-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Step 2: CPC codes */}
      {currentStep === 1 && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Actividades y códigos CPC</CardTitle>
            <CardDescription>
              Selecciona los códigos CPC que describen los bienes o servicios que ofreces.
              LicitaEC te alertará cuando aparezca un contrato relacionado.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <CpcSelector selected={selectedCpcs} onChange={setSelectedCpcs} />

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentStep(0)}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Atrás
              </Button>
              <Button
                type="button"
                className="flex-1 gap-2"
                onClick={handleStep2}
              >
                Continuar
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Plan selection */}
      {currentStep === 2 && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Elige tu plan</CardTitle>
            <CardDescription>
              14 días gratis en todos los planes · Sin tarjeta de crédito · Cancela cuando quieras
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              {PLANS.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    selectedPlan === plan.id
                      ? "border-[#1E40AF] bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          selectedPlan === plan.id
                            ? "border-[#1E40AF]"
                            : "border-gray-300"
                        }`}
                      >
                        {selectedPlan === plan.id && (
                          <div className="w-2 h-2 rounded-full bg-[#1E40AF]" />
                        )}
                      </div>
                      <span className="font-semibold text-gray-900">{plan.name}</span>
                      {plan.highlighted && (
                        <Badge className="text-xs">Popular</Badge>
                      )}
                    </div>
                    <span className="font-bold text-[#1E40AF]">{plan.price}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 ml-6">
                    {plan.features.map((f) => (
                      <span key={f} className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                        {f}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentStep(1)}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Atrás
              </Button>
              <Button
                type="button"
                className="flex-1 gap-2"
                onClick={handleFinish}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    Comenzar 14 días gratis
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>

            <p className="text-xs text-center text-gray-500">
              Podrás cambiar tu plan o agregar tu tarjeta en cualquier momento desde Configuración
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
