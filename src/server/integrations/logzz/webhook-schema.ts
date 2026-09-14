import { z } from "zod";

/**
 * Logzz webhook normalization.
 *
 * Logzz webhooks are configured in the merchant panel, where the merchant MAPS
 * order fields to custom JSON keys (documented examples include `cliente_name`
 * and `order_quantity`). There is therefore no single fixed schema. We define
 * the canonical keys we recommend the merchant configure (see README) and also
 * accept the documented example spellings as fallbacks. Nothing is invented:
 * the values come straight from whatever the merchant mapped.
 */

export const logzzWebhookPayloadSchema = z.record(z.string(), z.unknown());
export type LogzzWebhookPayload = z.infer<typeof logzzWebhookPayloadSchema>;

export interface NormalizedLogzzOrderEvent {
  /** External order id from Logzz (idempotency + order matching key). */
  externalId: string;
  /** Raw Logzz status text (kept as-is; mapped separately). */
  rawStatus: string;
  customerName?: string;
  customerPhone?: string;
  productExternalId?: string;
  productName?: string;
  quantity?: number;
  amountCents?: number;
  deliveryDate?: string;
  deliveryPeriod?: string;
  raw: unknown;
}

/** Recommended canonical keys → documented/likely fallbacks. */
const KEYS = {
  externalId: ["order_id", "external_id", "id", "pedido_id", "order"],
  status: ["order_status", "status", "status_pedido"],
  customerName: ["customer_name", "cliente_name", "client_name", "nome"],
  customerPhone: ["customer_phone", "cliente_phone", "phone", "telefone", "whatsapp"],
  productExternalId: ["product_id", "produto_id", "offer_id"],
  productName: ["product_name", "produto", "product"],
  quantity: ["order_quantity", "quantity", "quantidade"],
  amount: ["order_amount", "amount", "valor", "price", "preco"],
  deliveryDate: ["delivery_date", "data_entrega", "date"],
  deliveryPeriod: ["delivery_period", "periodo_entrega", "period"],
} as const;

function pickString(
  obj: Record<string, unknown>,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return undefined;
}

function pickAmountCents(
  obj: Record<string, unknown>,
  keys: readonly string[],
): number | undefined {
  const raw = pickString(obj, keys);
  if (!raw) return undefined;
  // Accept "49,90" / "49.90" / "4990" style values.
  const normalized = raw.replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}\b)/g, "");
  const value = Number.parseFloat(normalized.replace(",", "."));
  if (!Number.isFinite(value) || value < 0) return undefined;
  return Math.round(value * 100);
}

function pickInt(
  obj: Record<string, unknown>,
  keys: readonly string[],
): number | undefined {
  const raw = pickString(obj, keys);
  if (!raw) return undefined;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : undefined;
}

/**
 * Normalize a validated payload into a canonical order event, or null when the
 * required fields (external id + status) are missing.
 */
export function normalizeLogzzOrderEvent(
  payload: unknown,
): NormalizedLogzzOrderEvent | null {
  const parsed = logzzWebhookPayloadSchema.safeParse(payload);
  if (!parsed.success) return null;
  const obj = parsed.data;

  const externalId = pickString(obj, KEYS.externalId);
  const rawStatus = pickString(obj, KEYS.status);
  if (!externalId || !rawStatus) return null;

  return {
    externalId,
    rawStatus,
    customerName: pickString(obj, KEYS.customerName),
    customerPhone: pickString(obj, KEYS.customerPhone),
    productExternalId: pickString(obj, KEYS.productExternalId),
    productName: pickString(obj, KEYS.productName),
    quantity: pickInt(obj, KEYS.quantity),
    amountCents: pickAmountCents(obj, KEYS.amount),
    deliveryDate: pickString(obj, KEYS.deliveryDate),
    deliveryPeriod: pickString(obj, KEYS.deliveryPeriod),
    raw: obj,
  };
}
