# CLAUDE.md

## Proyecto

LicitaEC es un SaaS multi-tenant para que empresas ecuatorianas encuentren y gestionen
contratos públicos del SERCOP (Servicio Nacional de Contratación Pública de Ecuador).

## Package manager

- Siempre usar **bun** en vez de npm, yarn o pnpm
- `bun install` en lugar de `npm install`
- `bun run <script>` en lugar de `npm run <script>`
- `bunx` en lugar de `npx`
- `bun add <paquete>` en lugar de `npm install <paquete>`
- `bun remove <paquete>` en lugar de `npm uninstall <paquete>`

## Stack tecnológico

- **Frontend + API:** Next.js 15 con App Router, TypeScript estricto
- **Estilos:** Tailwind CSS + shadcn/ui (tema neutro)
- **Base de datos:** PostgreSQL via Supabase (con Row Level Security para multi-tenancy)
- **ORM:** Prisma
- **Autenticación:** NextAuth.js v5 con provider de Credentials + Email magic link
- **Background jobs:** BullMQ con Redis (Upstash en prod)
- **Pagos:** Stripe (Checkout + Webhooks + Customer Portal)
- **Email:** Resend con React Email
- **Storage:** Supabase Storage (documentos de licitación)
- **Deploy:** Vercel (app) + Railway (workers Redis/BullMQ)

## Fuente de datos — API SERCOP (OCDS)

- **Búsqueda:** `GET https://datosabiertos.compraspublicas.gob.ec/PLATAFORMA/api/search_ocds`
  - Params: `year`, `search`, `page`, `buyer`, `supplier`
- **Registro de proceso:** `GET https://datosabiertos.compraspublicas.gob.ec/PLATAFORMA/api/record?ocid={ocid}`
- **Formato:** OCDS (Open Contracting Data Standard) JSON
- **Sincronización:** polling cada 15 minutos con backoff exponencial en errores 429

## Modelo de negocio

- **Plan Básico $29/mes:** alertas email, hasta 5 códigos CPC, 1 usuario
- **Plan Profesional $79/mes:** alertas tiempo real, CPC ilimitados, dashboard analítico, 3 usuarios
- **Plan Empresa $199/mes:** todo + gestión documental, pipeline licitaciones, API propia, usuarios ilimitados

## Contexto ecuatoriano

- **RUC:** número de identificación fiscal ecuatoriano (13 dígitos), campo obligatorio por empresa
- **RUP:** Registro Único de Proveedores de SERCOP — código de habilitación para licitar
- **Códigos CPC:** Clasificador Central de Productos — 5 dígitos (categoría) o 9 dígitos (producto específico).
  Un match de 5 dígitos cubre todos los productos 9-dígitos dentro de esa categoría
- Los contratos son en **USD**
- **Provincias principales:** Pichincha, Guayas, Azuay, Manabí, El Oro

## Taxonomía de métodos de contratación

Ecuador clasifica los procedimientos según (1) naturaleza del bien: normalizado o no normalizado,
y (2) presupuesto referencial. La clasificación OCP define la competitividad:

### OPEN (alta competencia — PRIORIDAD de la plataforma)
- **Subasta Inversa Electrónica (SIE):** bienes/servicios normalizados, pujas a la baja en tiempo real
- **Licitación:** procesos de alta cuantía, requisitos técnicos rigurosos
- **Cotización:** bienes/servicios no normalizados de cuantía media

### SELECTIVE (acceso limitado — PRIORIDAD secundaria)
- **Menor Cuantía:** prioriza proveedores locales y micro/pequeñas empresas

### LIMITED (pre-calificación — monitoreo informativo)
- **Consultoría – Lista Corta:** selección de una terna pre-calificada por la entidad contratante

### DIRECT (⚠️ NO monitoreable preventivamente)
- **Ínfima Cuantía:** contratación directa para montos reducidos. Se publica en SERCOP
  DESPUÉS de emitida la factura — no existe proceso de licitación previo.
  La plataforma NO debe mostrar alertas para este tipo; solo puede mostrarlo
  como dato histórico en analytics de la entidad contratante.

## Foco estratégico

Los métodos Open y Selective son donde la velocidad de respuesta y el análisis de competencia
determinan si una empresa gana o pierde. Un alto porcentaje de procesos se adjudica con un
SOLO oferente — lo que indica que muchas empresas pierden contratos por no enterarse a tiempo.
Argumento central de valor: **"llega antes que tu competencia"**.

## Comandos útiles

- `bun run dev` — levantar en local
- `bun test` — correr tests
- `bun run lint` — lint con ESLint

## Reglas de estilo

- Funciones con nombres descriptivos en camelCase
- No usar `any` en TypeScript
- Preferir composición sobre herencia

## Convenciones de código

- **Español** para nombres de variables de dominio (`ruc`, `codigoCpc`, `entidadContratante`)
- **Inglés** para infraestructura técnica (`components`, `hooks`, `utils`)
- Siempre manejar errores con Result types o try/catch explícito, nunca silenciar errores
- Todas las rutas de API protegidas con middleware de autenticación y verificación de plan
- RLS en Supabase: cada query de usuario está scoped a su `org_id` automáticamente

## Errores comunes (agregar aquí cuando Claude se equivoque)

- No modificar archivos en /generated — son autogenerados
- Siempre correr migrations antes de tests de integración
