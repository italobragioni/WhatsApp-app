import type { UserRole } from "@prisma/client";
import type { DefaultSession } from "next-auth";

/**
 * Module augmentation so `session.user` and the JWT carry our custom fields
 * (`id`, `role`) with full type-safety.
 */
declare module "next-auth" {
  interface User {
    role: UserRole;
  }

  interface Session {
    user: {
      id: string;
      role: UserRole;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: UserRole;
  }
}
