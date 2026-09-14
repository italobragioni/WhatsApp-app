import type { Product } from "@prisma/client";
import { z } from "zod";

import { slugify } from "@/lib/slug";
import { prisma } from "@/server/db/prisma";

/**
 * Product business logic. Pure DB operations with validated input — no external
 * integrations involved.
 */

export const productInputSchema = z.object({
  name: z.string().min(2).max(160),
  description: z.string().max(5000).optional().nullable(),
  priceCents: z.number().int().min(0).default(0),
  currency: z.string().length(3).default("BRL"),
  benefits: z.array(z.string().min(1)).default([]),
  features: z.array(z.string().min(1)).default([]),
  salesArguments: z.array(z.string().min(1)).default([]),
  warranty: z.string().max(2000).optional().nullable(),
  deliveryInfo: z.string().max(2000).optional().nullable(),
  paymentInfo: z.string().max(2000).optional().nullable(),
  aiAllowedTopics: z.array(z.string().min(1)).default([]),
  aiForbiddenTopics: z.array(z.string().min(1)).default([]),
  checkoutUrl: z.string().url().optional().nullable(),
  active: z.boolean().default(true),
});

export type ProductInput = z.input<typeof productInputSchema>;

export async function listProducts(): Promise<Product[]> {
  return prisma.product.findMany({ orderBy: { createdAt: "desc" } });
}

export async function getProduct(id: string): Promise<Product | null> {
  return prisma.product.findUnique({ where: { id } });
}

async function uniqueSlug(name: string, ignoreId?: string): Promise<string> {
  const base = slugify(name) || "produto";
  let candidate = base;
  let suffix = 1;
  // Ensure uniqueness across products.
  while (true) {
    const existing = await prisma.product.findUnique({
      where: { slug: candidate },
    });
    if (!existing || existing.id === ignoreId) return candidate;
    candidate = `${base}-${suffix++}`;
  }
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const data = productInputSchema.parse(input);
  const slug = await uniqueSlug(data.name);
  return prisma.product.create({ data: { ...data, slug } });
}

export async function updateProduct(
  id: string,
  input: ProductInput,
): Promise<Product> {
  const data = productInputSchema.parse(input);
  const slug = await uniqueSlug(data.name, id);
  return prisma.product.update({ where: { id }, data: { ...data, slug } });
}

export async function setProductActive(
  id: string,
  active: boolean,
): Promise<Product> {
  return prisma.product.update({ where: { id }, data: { active } });
}
