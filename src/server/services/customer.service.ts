import type { Customer } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/server/db/prisma";

/** Customer / CRM business logic. */

export const customerInputSchema = z.object({
  name: z.string().max(160).optional().nullable(),
  phone: z.string().min(8).max(20),
  email: z.string().email().optional().nullable(),
  addressLine: z.string().max(240).optional().nullable(),
  number: z.string().max(20).optional().nullable(),
  complement: z.string().max(120).optional().nullable(),
  district: z.string().max(120).optional().nullable(),
  city: z.string().max(120).optional().nullable(),
  state: z.string().max(60).optional().nullable(),
  postalCode: z.string().max(12).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
});

export type CustomerInput = z.input<typeof customerInputSchema>;

export async function listCustomers(): Promise<Customer[]> {
  return prisma.customer.findMany({ orderBy: { createdAt: "desc" } });
}

export async function getCustomer(id: string): Promise<Customer | null> {
  return prisma.customer.findUnique({ where: { id } });
}

/**
 * Find an existing customer by phone or create a new one. This is the primary
 * entry point when an inbound WhatsApp message arrives (future flow).
 */
export async function upsertCustomerByPhone(
  phone: string,
  data?: Partial<CustomerInput>,
): Promise<Customer> {
  return prisma.customer.upsert({
    where: { phone },
    create: { phone, ...data },
    update: data ?? {},
  });
}
