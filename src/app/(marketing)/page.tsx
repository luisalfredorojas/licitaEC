import Link from "next/link";
import {
  Bell,
  BarChart3,
  Kanban,
  CheckCircle,
  ArrowRight,
  Shield,
  Clock,
  Users,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    icon: Bell,
    title: "Alertas instantáneas",
    description:
      "Recibe notificación en minutos cuando SERCOP publica un contrato que coincide con tus códigos CPC. No pierdas oportunidades por enterarte tarde.",
  },
  {
    icon: Kanban,
    title: "Gestión de licitaciones",
    description:
      "Kanban board para seguir cada oportunidad desde interés hasta adjudicación. Asigna responsables, adjunta documentos y lleva el control de tus ofertas.",
  },
  {
    icon: BarChart3,
    title: "Analytics de mercado",
    description:
      "Entiende quién gana contratos en tu sector, montos históricos y tendencias. Identifica patrones y prepara propuestas más competitivas.",
  },
];

const plans = [
  {
    name: "Básico",
    price: "$29",
    description: "Para empresas que recién comienzan",
    features: [
      "Alertas por email",
      "Hasta 5 códigos CPC",
      "1 usuario",
      "Historial 3 meses",
      "Soporte por email",
    ],
    cta: "Comenzar gratis",
    highlighted: false,
    href: "/register?plan=basic",
  },
  {
    name: "Profesional",
    price: "$79",
    description: "Para empresas que licitan activamente",
    features: [
      "Alertas en tiempo real (< 15 min)",
      "Códigos CPC ilimitados",
      "Hasta 3 usuarios",
      "Dashboard analítico",
      "Pipeline de licitaciones",
      "Historial completo",
      "Soporte prioritario",
    ],
    cta: "Comenzar gratis",
    highlighted: true,
    href: "/register?plan=professional",
  },
  {
    name: "Empresa",
    price: "$199",
    description: "Para equipos de compras y consultoras",
    features: [
      "Todo lo del plan Profesional",
      "Gestión documental",
      "Pipeline avanzado con analytics",
      "API propia",
      "Usuarios ilimitados",
      "Integraciones personalizadas",
      "Soporte dedicado",
    ],
    cta: "Contactar ventas",
    highlighted: false,
    href: "/register?plan=enterprise",
  },
];

const stats = [
  { value: "+80,000", label: "contratos monitoreados" },
  { value: "< 15 min", label: "tiempo de alerta" },
  { value: "6", label: "tipos de procedimiento" },
  { value: "24/7", label: "monitoreo continuo" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#1E40AF] rounded-lg flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <span className="text-xl font-bold text-[#1E40AF]">LicitaEC</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <Link href="#features" className="text-sm text-gray-600 hover:text-[#1E40AF] transition-colors">
                Funcionalidades
              </Link>
              <Link href="#pricing" className="text-sm text-gray-600 hover:text-[#1E40AF] transition-colors">
                Precios
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Iniciar sesión
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm">
                  Empezar gratis
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50 to-white py-20 lg:py-32">
        <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] -z-10" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Badge variant="secondary" className="mb-6 text-[#1E40AF] bg-blue-50 border-blue-200">
            ✦ Plataforma SERCOP para empresas ecuatorianas
          </Badge>
          <h1 className="text-4xl lg:text-6xl font-extrabold text-gray-900 tracking-tight mb-6 max-w-4xl mx-auto">
            Encuentra contratos públicos{" "}
            <span className="text-[#1E40AF]">antes que tu competencia</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            La mayoría de contratos del SERCOP se adjudican con un solo oferente. No porque no haya
            competidores — sino porque{" "}
            <strong className="text-gray-900">llegan tarde</strong>. LicitaEC te alerta en
            minutos cuando aparece un contrato que coincide con tu RUP.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" className="gap-2 text-base px-8">
                Comenzar gratis 14 días
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="#features">
              <Button size="lg" variant="outline" className="gap-2 text-base px-8">
                Ver funcionalidades
                <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>

          {/* Credibility bar */}
          <div className="mt-14 pt-10 border-t border-gray-200">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
              {stats.map((stat) => (
                <div key={stat.value} className="text-center">
                  <div className="text-2xl font-bold text-[#1E40AF]">{stat.value}</div>
                  <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Dashboard Preview Placeholder */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="rounded-2xl bg-gradient-to-br from-[#1E40AF] to-blue-700 p-1 shadow-2xl">
            <div className="rounded-xl bg-gray-900 p-6 aspect-video flex items-center justify-center">
              <div className="text-center text-gray-400">
                <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p className="text-sm">Vista previa del dashboard</p>
                <p className="text-xs mt-1 opacity-60">Disponible al registrarse</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Todo lo que necesitas para ganar más contratos
            </h2>
            <p className="text-lg text-gray-600 max-w-xl mx-auto">
              Diseñado específicamente para el proceso de contratación pública ecuatoriana
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.title} className="border-gray-100 hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-4">
                      <Icon className="w-6 h-6 text-[#1E40AF]" />
                    </div>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-base leading-relaxed">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Additional value props */}
          <div className="mt-20 grid md:grid-cols-3 gap-6">
            {[
              { icon: Clock, title: "Sincronización cada 15 min", desc: "Polling continuo contra la API OCDS del SERCOP" },
              { icon: Shield, title: "Datos 100% oficiales", desc: "Fuente directa: datosabiertos.compraspublicas.gob.ec" },
              { icon: Users, title: "Multi-usuario", desc: "Comparte el acceso con tu equipo de ventas" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex gap-4 p-6 rounded-xl bg-gray-50">
                  <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Icon className="w-5 h-5 text-[#1E40AF]" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 mb-1">{item.title}</div>
                    <div className="text-sm text-gray-600">{item.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Precios transparentes, sin sorpresas
            </h2>
            <p className="text-lg text-gray-600">
              14 días de prueba gratis · Sin tarjeta de crédito · Cancela cuando quieras
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={`relative ${
                  plan.highlighted
                    ? "border-[#1E40AF] shadow-xl shadow-blue-100 scale-105"
                    : "border-gray-200"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-[#1E40AF] text-white text-xs px-3">Más popular</Badge>
                  </div>
                )}
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-extrabold text-gray-900">{plan.price}</span>
                    <span className="text-gray-500 ml-1">/mes</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href={plan.href} className="block mt-6">
                    <Button
                      className="w-full"
                      variant={plan.highlighted ? "default" : "outline"}
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 bg-[#1E40AF]">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-6">
            Empieza a ganar contratos hoy
          </h2>
          <p className="text-blue-200 text-lg mb-8">
            Más de 80,000 contratos públicos monitoreados. Alertas en menos de 15 minutos.
            Sin compromiso — 14 días gratis.
          </p>
          <Link href="/register">
            <Button size="lg" variant="secondary" className="gap-2 text-base px-8">
              Crear cuenta gratis
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-[#1E40AF] rounded-lg flex items-center justify-center">
                <Shield className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-semibold text-white">LicitaEC</span>
            </div>
            <div className="flex gap-6 text-sm">
              <Link href="#" className="hover:text-white transition-colors">Términos de uso</Link>
              <Link href="#" className="hover:text-white transition-colors">Privacidad</Link>
              <Link href="#" className="hover:text-white transition-colors">Contacto</Link>
            </div>
            <div className="text-sm">
              © {new Date().getFullYear()} LicitaEC. Todos los derechos reservados.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
