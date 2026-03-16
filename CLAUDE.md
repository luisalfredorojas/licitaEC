# CLAUDE.md

## Package manager
- Siempre usar **bun** en vez de npm, yarn o pnpm
- `bun install` en lugar de `npm install`
- `bun run <script>` en lugar de `npm run <script>`
- `bunx` en lugar de `npx`
- `bun add <paquete>` en lugar de `npm install <paquete>`
- `bun remove <paquete>` en lugar de `npm uninstall <paquete>`

## Stack
- Bun, TypeScript, React 18, PostgreSQL

## Comandos útiles
- `bun run dev` — levantar en local
- `bun test` — correr tests
- `bun run lint` — lint con ESLint

## Reglas de estilo
- Funciones con nombres descriptivos en camelCase
- No usar `any` en TypeScript
- Preferir composición sobre herencia

## Errores comunes (agregar aquí cuando Claude se equivoque)
- No modificar archivos en /generated — son autogenerados
- Siempre correr migrations antes de tests de integración
