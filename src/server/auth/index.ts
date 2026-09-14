import { type UserRole } from "@prisma/client";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

import { prisma } from "@/server/db/prisma";
import { logger } from "@/server/logger/logger";

import { authConfig } from "./config";
import { verifyPassword } from "./password";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * Full Auth.js instance (Node.js runtime). Adds the credentials provider that
 * validates a user against the database. Server components and route handlers
 * import `auth` from here; the middleware uses the edge-safe config instead.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    jwt({ token, user }) {
      if (user) {
        const u = user as { id?: string; role?: UserRole };
        if (u.id) token.id = u.id;
        if (u.role) token.role = u.role;
      }
      return token;
    },
    session({ session, token }) {
      const t = token as { id?: string; role?: UserRole };
      if (t.id) session.user.id = t.id;
      if (t.role) session.user.role = t.role;
      return session;
    },
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) {
          return null;
        }

        const { email, password } = parsed.data;
        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        });

        if (!user || !user.active) {
          // Run a dummy comparison to reduce timing side-channels.
          await verifyPassword(password, "$2a$12$" + "x".repeat(53));
          return null;
        }

        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) {
          logger.warn("auth", "Failed login attempt", { email });
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
});
