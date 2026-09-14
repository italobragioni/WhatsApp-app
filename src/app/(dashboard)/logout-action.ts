"use server";

import { signOut } from "@/server/auth";

export async function logout(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
