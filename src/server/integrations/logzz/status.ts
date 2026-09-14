import { OrderStatus } from "@prisma/client";

/**
 * Maps Logzz order statuses (as documented in the official help center,
 * "Status de pedidos: quais são e seus significados") to our internal
 * OrderStatus enum. External values are kept SEPARATE from internal ones: the
 * raw Logzz status is always preserved on the order metadata.
 *
 * Documented Logzz statuses: Agendado, A Reagendar, Em Separação, Em Rota /
 * A Caminho, Entregue, Cancelado, Frustrado.
 *
 * An unrecognized status maps to `null` (we keep the current internal status
 * and just store the raw value) — we never guess.
 */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

const MAP: Record<string, OrderStatus> = {
  agendado: OrderStatus.PLACED,
  reagendar: OrderStatus.PLACED,
  "a reagendar": OrderStatus.PLACED,
  "em separacao": OrderStatus.CONFIRMED,
  "em rota": OrderStatus.SHIPPED,
  "a caminho": OrderStatus.SHIPPED,
  entregue: OrderStatus.DELIVERED,
  cancelado: OrderStatus.CANCELLED,
  frustrado: OrderStatus.RETURNED,
};

export function mapLogzzStatus(raw: string): OrderStatus | null {
  return MAP[normalize(raw)] ?? null;
}
