import { z } from "zod";

/**
 * Zod schemas for the WhatsApp Cloud API webhook payload. We validate the
 * envelope structure and never trust the raw JSON. Message content objects use
 * `.passthrough()` so we can read type-specific fields (text/image/audio/...)
 * in the provider without over-constraining Meta's evolving payloads.
 */

export const contactSchema = z.object({
  wa_id: z.string(),
  profile: z.object({ name: z.string() }).partial().optional(),
});

export const inboundMessageSchema = z
  .object({
    from: z.string(),
    id: z.string(),
    timestamp: z.string().optional(),
    type: z.string(),
  })
  .passthrough();

export const changeValueSchema = z
  .object({
    messaging_product: z.string().optional(),
    metadata: z
      .object({
        display_phone_number: z.string().optional(),
        phone_number_id: z.string().optional(),
      })
      .partial()
      .optional(),
    contacts: z.array(contactSchema).optional(),
    messages: z.array(inboundMessageSchema).optional(),
    // Delivery/read receipts for OUR outbound messages — ignored (loop guard).
    statuses: z.array(z.unknown()).optional(),
  })
  .passthrough();

export const changeSchema = z
  .object({
    field: z.string(),
    value: changeValueSchema,
  })
  .passthrough();

export const entrySchema = z
  .object({
    id: z.string().optional(),
    changes: z.array(changeSchema),
  })
  .passthrough();

export const webhookPayloadSchema = z
  .object({
    object: z.string().optional(),
    entry: z.array(entrySchema),
  })
  .passthrough();

export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;
export type InboundMessageRaw = z.infer<typeof inboundMessageSchema>;
export type ContactRaw = z.infer<typeof contactSchema>;
