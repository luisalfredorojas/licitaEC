import { NextRequest, NextResponse } from "next/server";

const CPC_CODES = [
  { code: "61110", description: "Servicios de construcción de edificios residenciales" },
  { code: "61120", description: "Servicios de construcción de edificios no residenciales" },
  { code: "51000", description: "Servicios de transporte terrestre" },
  { code: "51200", description: "Servicios de transporte por carretera de mercancías" },
  { code: "84111", description: "Servicios de administración general del Estado" },
  { code: "86110", description: "Servicios hospitalarios" },
  { code: "86210", description: "Servicios de medicina general" },
  { code: "92110", description: "Servicios de reparación de computadoras y periféricos" },
  { code: "72100", description: "Servicios de tecnología de la información" },
  { code: "72200", description: "Servicios de consultoría en tecnología de la información" },
  { code: "69201", description: "Servicios de contabilidad y teneduría de libros" },
  { code: "69300", description: "Servicios de auditoría" },
  { code: "62010", description: "Servicios de desarrollo de software" },
  { code: "62020", description: "Servicios de consultoría en sistemas informáticos" },
  { code: "55101", description: "Servicios de alojamiento en hoteles" },
  { code: "56101", description: "Servicios de restaurantes y comedores" },
  { code: "85100", description: "Servicios de enseñanza preescolar y primaria" },
  { code: "85200", description: "Servicios de enseñanza secundaria" },
  { code: "46110", description: "Servicios de venta al por mayor de productos farmacéuticos" },
  { code: "33120", description: "Servicios de mantenimiento y reparación de maquinaria" },
  { code: "71121", description: "Servicios de ingeniería civil" },
  { code: "71122", description: "Servicios de arquitectura" },
  { code: "80100", description: "Servicios de investigación y guardia privada" },
  { code: "81210", description: "Servicios de limpieza de edificios" },
  { code: "49000", description: "Servicios de suministro de agua" },
  { code: "35110", description: "Servicios de generación de electricidad" },
  { code: "64191", description: "Servicios bancarios de depósito" },
  { code: "95120", description: "Servicios de reparación de teléfonos celulares" },
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q")?.toLowerCase() ?? "";

  if (!query || query.length < 2) {
    return NextResponse.json({ results: CPC_CODES.slice(0, 10) });
  }

  const results = CPC_CODES.filter(
    (cpc) =>
      cpc.code.includes(query) ||
      cpc.description.toLowerCase().includes(query)
  ).slice(0, 15);

  return NextResponse.json({ results });
}
