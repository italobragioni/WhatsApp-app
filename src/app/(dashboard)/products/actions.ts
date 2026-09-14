"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createProduct } from "@/server/services/product.service";

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

const formSchema = z.object({
  name: z.string().min(2, "Nome muito curto").max(160),
  price: z.string().default("0"),
  description: z.string().max(5000).optional(),
  warranty: z.string().max(2000).optional(),
  paymentInfo: z.string().max(2000).optional(),
  deliveryInfo: z.string().max(2000).optional(),
  checkoutUrl: z.string().url("URL inválida").optional().or(z.literal("")),
  externalId: z.string().max(120).optional(),
  offerId: z.string().max(120).optional(),
});

export type ProductFormState = { error: string } | undefined;

export async function createProductAction(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
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
    return {
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }

  try {
    await createProduct({
      name: parsed.data.name,
      priceCents: parsePriceToCents(parsed.data.price),
      description: parsed.data.description ?? null,
      warranty: parsed.data.warranty ?? null,
      paymentInfo: parsed.data.paymentInfo ?? null,
      deliveryInfo: parsed.data.deliveryInfo ?? null,
      checkoutUrl: parsed.data.checkoutUrl ? parsed.data.checkoutUrl : null,
      externalId: parsed.data.externalId ?? null,
      offerId: parsed.data.offerId ?? null,
      benefits: linesToArray(formData.get("benefits")),
      features: linesToArray(formData.get("features")),
      salesArguments: linesToArray(formData.get("salesArguments")),
      active: formData.get("active") === "on",
    });
  } catch {
    return { error: "Não foi possível salvar o produto." };
  }

  revalidatePath("/products");
  redirect("/products");
}
