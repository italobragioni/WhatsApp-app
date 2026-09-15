"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { LONG_TEXT_MAX } from "@/lib/limits";
import { auth } from "@/server/auth";
import {
  createProduct,
  getProduct,
  updateProduct,
} from "@/server/services/product.service";

/** Parse a BRL price string ("49,90" / "49.90" / "49") into integer cents. */
function parsePriceToCents(raw: string): number {
  const normalized = raw.replace(/\./g, "").replace(",", ".").trim();
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(value * 100);
}

/** Split a textarea (one item per line) into a clean string array. */
function linesToArray(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string") return [];
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

// Long AI-facing fields allow up to LONG_TEXT_MAX; short/technical stay tight.
const formSchema = z.object({
  name: z.string().min(2, "Nome muito curto").max(160),
  price: z.string().default("0"),
  description: z.string().max(LONG_TEXT_MAX).optional(),
  warranty: z.string().max(LONG_TEXT_MAX).optional(),
  paymentInfo: z.string().max(LONG_TEXT_MAX).optional(),
  deliveryInfo: z.string().max(LONG_TEXT_MAX).optional(),
  checkoutUrl: z.string().url("URL inválida").optional().or(z.literal("")),
  externalId: z.string().max(120).optional(),
  offerId: z.string().max(120).optional(),
});

export type ProductFormState = { error: string } | undefined;

/** Ensure the caller is authenticated before mutating products. */
async function requireAuth(): Promise<void> {
  const session = await auth();
  if (!session?.user) redirect("/login");
}

/** Validate + normalize the shared product form fields. */
function parseForm(formData: FormData) {
  const parsed = formSchema.safeParse({
    name: formData.get("name") ?? "",
    price: formData.get("price") ?? "0",
    description: formData.get("description") || undefined,
    warranty: formData.get("warranty") || undefined,
    paymentInfo: formData.get("paymentInfo") || undefined,
    deliveryInfo: formData.get("deliveryInfo") || undefined,
    checkoutUrl: formData.get("checkoutUrl") || "",
    externalId: formData.get("externalId") || undefined,
    offerId: formData.get("offerId") || undefined,
  });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const d = parsed.data;
  return {
    ok: true as const,
    value: {
      name: d.name,
      priceCents: parsePriceToCents(d.price),
      description: d.description ?? null,
      warranty: d.warranty ?? null,
      paymentInfo: d.paymentInfo ?? null,
      deliveryInfo: d.deliveryInfo ?? null,
      checkoutUrl: d.checkoutUrl ? d.checkoutUrl : null,
      externalId: d.externalId ?? null,
      offerId: d.offerId ?? null,
      benefits: linesToArray(formData.get("benefits")),
      features: linesToArray(formData.get("features")),
      salesArguments: linesToArray(formData.get("salesArguments")),
      active: formData.get("active") === "on",
    },
  };
}

export async function createProductAction(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  await requireAuth();

  const parsed = parseForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  try {
    await createProduct(parsed.value);
  } catch {
    return { error: "Não foi possível salvar o produto." };
  }

  revalidatePath("/products");
  redirect("/products");
}

export async function updateProductAction(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  await requireAuth();

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Produto inválido." };

  const parsed = parseForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  // Load the existing product to preserve fields not present in the form
  // (currency and AI topics), keep the same ID, and confirm it exists.
  const existing = await getProduct(id);
  if (!existing) return { error: "Produto não encontrado." };

  try {
    await updateProduct(id, {
      ...parsed.value,
      currency: existing.currency,
      aiAllowedTopics: existing.aiAllowedTopics,
      aiForbiddenTopics: existing.aiForbiddenTopics,
    });
  } catch {
    return { error: "Não foi possível atualizar o produto." };
  }

  revalidatePath("/products");
  revalidatePath(`/products/${id}/edit`);
  redirect("/products");
}
