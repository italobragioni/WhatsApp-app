import NextAuth from "next-auth";

import { authConfig } from "@/server/auth/config";

// Edge-runtime auth middleware. Uses the Prisma-free config so it stays
// edge-compatible; the `authorized` callback enforces route protection.
export const { auth: middleware } = NextAuth(authConfig);

export default middleware;

export const config = {
  /**
   * Run on all routes except:
   *  - Next.js internals (_next)
   *  - the auth API and other API routes (they handle their own auth)
   *  - static asset files
   */
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
