import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe NextAuth config.
 * Does NOT import bcrypt, Prisma, or any Node.js-only modules.
 * Used by middleware.ts which runs in Edge Runtime.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: { strategy: "jwt" as const },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = nextUrl;

      const protectedRoutes = [
        "/dashboard",
        "/contratos",
        "/alertas",
        "/pipeline",
        "/analytics",
        "/configuracion",
        "/onboarding",
      ];
      const protectedApiRoutes = [
        "/api/contratos",
        "/api/alertas",
        "/api/pipeline",
        "/api/cpc",
        "/api/onboarding",
        "/api/dashboard",
      ];

      const isProtectedPage = protectedRoutes.some((r) => pathname.startsWith(r));
      const isProtectedApi = protectedApiRoutes.some((r) => pathname.startsWith(r));

      if (isProtectedApi && !isLoggedIn) return false;
      if (isProtectedPage && !isLoggedIn) return false;

      return true;
    },
  },
  providers: [], // Providers added in lib/auth.ts (Node.js only)
} satisfies NextAuthConfig;
