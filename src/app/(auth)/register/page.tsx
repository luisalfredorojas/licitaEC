"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, AlertCircle } from "lucide-react";

const registerSchema = z
  .object({
    nombre: z.string().min(2, "Nombre debe tener al menos 2 caracteres"),
    email: z.string().email("Email inválido"),
    password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
    confirmPassword: z.string(),
    nombreEmpresa: z.string().min(2, "Nombre de empresa requerido"),
    ruc: z
      .string()
      .regex(/^\d{10}(\d{3})?$/, "RUC debe ser de 10 o 13 dígitos"),
    aceptarTerminos: z.literal(true, {
      errorMap: () => ({ message: "Debes aceptar los términos de uso" }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  async function onSubmit(data: RegisterForm) {
    setServerError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: data.nombre,
          email: data.email,
          password: data.password,
          nombreEmpresa: data.nombreEmpresa,
          ruc: data.ruc,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        setServerError(body.error ?? "Error al crear la cuenta");
        return;
      }

      const signInResult = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (signInResult?.error) {
        setServerError("Cuenta creada pero error al iniciar sesión. Por favor inicia sesión manualmente.");
        router.push("/login");
        return;
      }

      router.push("/onboarding");
    } catch {
      setServerError("Error de conexión. Por favor intenta nuevamente.");
    }
  }

  return (
    <Card className="w-full max-w-lg shadow-lg">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">Crear cuenta</CardTitle>
        <CardDescription>
          14 días gratis · Sin tarjeta de crédito · Cancela cuando quieras
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {serverError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="nombre">Nombre completo</Label>
              <Input
                id="nombre"
                placeholder="Juan Pérez"
                {...register("nombre")}
                aria-invalid={!!errors.nombre}
              />
              {errors.nombre && (
                <p className="text-xs text-red-600">{errors.nombre.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nombreEmpresa">Nombre de empresa</Label>
              <Input
                id="nombreEmpresa"
                placeholder="Mi Empresa S.A."
                {...register("nombreEmpresa")}
                aria-invalid={!!errors.nombreEmpresa}
              />
              {errors.nombreEmpresa && (
                <p className="text-xs text-red-600">{errors.nombreEmpresa.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ruc">RUC</Label>
            <Input
              id="ruc"
              placeholder="1790012345001"
              maxLength={13}
              {...register("ruc")}
              aria-invalid={!!errors.ruc}
            />
            {errors.ruc ? (
              <p className="text-xs text-red-600">{errors.ruc.message}</p>
            ) : (
              <p className="text-xs text-gray-500">RUC de 10 o 13 dígitos registrado en el SRI</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email empresarial</Label>
            <Input
              id="email"
              type="email"
              placeholder="juan@miempresa.com"
              {...register("email")}
              aria-invalid={!!errors.email}
            />
            {errors.email && (
              <p className="text-xs text-red-600">{errors.email.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 8 caracteres"
                {...register("password")}
                aria-invalid={!!errors.password}
              />
              {errors.password && (
                <p className="text-xs text-red-600">{errors.password.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Repetir contraseña"
                {...register("confirmPassword")}
                aria-invalid={!!errors.confirmPassword}
              />
              {errors.confirmPassword && (
                <p className="text-xs text-red-600">{errors.confirmPassword.message}</p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-2 pt-1">
            <input
              id="aceptarTerminos"
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-gray-300 text-[#1E40AF] focus:ring-[#1E40AF]"
              {...register("aceptarTerminos")}
            />
            <label htmlFor="aceptarTerminos" className="text-sm text-gray-600">
              Acepto los{" "}
              <Link href="#" className="text-[#1E40AF] underline hover:no-underline">
                términos de uso
              </Link>{" "}
              y la{" "}
              <Link href="#" className="text-[#1E40AF] underline hover:no-underline">
                política de privacidad
              </Link>
            </label>
          </div>
          {errors.aceptarTerminos && (
            <p className="text-xs text-red-600">{errors.aceptarTerminos.message}</p>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creando cuenta...
              </>
            ) : (
              "Crear cuenta gratis"
            )}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-sm text-gray-600">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="text-[#1E40AF] font-medium hover:underline">
            Iniciar sesión
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
