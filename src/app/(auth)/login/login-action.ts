"use server";

import { AuthError } from "next-auth";

import { signIn } from "@/server/auth";

export type LoginState = { error: string } | undefined;

/**
 * Server action that authenticates via the credentials provider. On success
 * Auth.js throws a redirect (to /dashboard) which must propagate; on failure
 * we return a generic message (no user enumeration).
 */
export async function authenticate(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/dashboard",
    });
    return undefined;
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Email ou senha inválidos." };
    }
    // Re-throw redirects and anything else.
    throw error;
  }
}
