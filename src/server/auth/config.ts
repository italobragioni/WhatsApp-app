import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js configuration.
 *
 * This file must NOT import Prisma, bcrypt, or any Node-only module: it is used
 * by the middleware, which runs on the edge runtime. The credentials provider
 * (which does touch the database) is added in `./index.ts`, which runs in the
 * Node.js runtime.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  // Providers are added in the Node-runtime config (index.ts).
  providers: [],
  callbacks: {
    /**
     * Route protection used by the middleware. Every route except the login
     * page requires an authenticated session.
     */
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = Boolean(auth?.user);
      const isLoginPage = nextUrl.pathname === "/login";

      if (isLoginPage) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/dashboard", nextUrl));
        }
        return true;
      }

      // Any other matched route requires a session.
      return isLoggedIn;
    },
  },
} satisfies NextAuthConfig;
