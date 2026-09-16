import { z } from "zod";

/**
 * Checkout offers for a product. A product may expose several purchase options
 * (e.g. "1 unidade" and "2 unidades"), each with its own Logzz link and price.
 * These are stored as JSON on `Product.checkoutOptions`; when empty, the single
 * `Product.checkoutUrl` is treated as one default offer.
 *
 * The customer picks one and the app sends the EXACT cadastrado URL — the model
 * never writes links; it only selects which offer applies.
 */
export interface CheckoutOffer {
  label: string;
  priceCents: number;
  url: string;
}

/** Validation for a single offer (used by the product form/service). */
export const checkoutOfferSchema = z.object({
  label: z.string().min(1).max(80),
  priceCents: z.number().int().min(0),
  url: z.string().url(),
});

export const checkoutOffersSchema = z.array(checkoutOfferSchema);

/** Safely parse the JSON `checkoutOptions` value into a typed offer list. */
export function parseCheckoutOptions(raw: unknown): CheckoutOffer[] {
  const parsed = checkoutOffersSchema.safeParse(raw);
  return parsed.success ? parsed.data : [];
}

/** Minimal product shape needed to derive offers. */
interface OfferSource {
  checkoutOptions?: unknown;
  checkoutUrl?: string | null;
  priceCents?: number;
}

/**
 * Normalize a product's checkout offers. Multi-option checkout takes precedence;
 * otherwise the legacy single `checkoutUrl` becomes one default offer. Returns
 * an empty list when the product has no checkout link at all.
 */
export function getProductOffers(
  product: OfferSource | null | undefined,
): CheckoutOffer[] {
  if (!product) return [];
  const options = parseCheckoutOptions(product.checkoutOptions);
  if (options.length > 0) return options;
  if (product.checkoutUrl) {
    return [
      {
        label: "Comprar",
        priceCents: product.priceCents ?? 0,
        url: product.checkoutUrl,
      },
    ];
  }
  return [];
}

/** Lowercase + strip accents so matching is robust to typing. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const WORD_NUMBERS: Record<string, number> = {
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
};

/** Does the customer's message clearly point to this specific offer? */
function textMatchesOffer(text: string, offer: CheckoutOffer): boolean {
  const t = normalize(text);

  // Quantity taken from the label (e.g. "2 unidades" -> "2").
  const qty = offer.label.match(/\d+/)?.[0] ?? null;
  if (qty) {
    if (new RegExp(`(^|\\D)${qty}(\\D|$)`).test(t)) return true;
    for (const [word, n] of Object.entries(WORD_NUMBERS)) {
      if (String(n) === qty && new RegExp(`\\b${word}\\b`).test(t)) return true;
    }
  }

  // Price in reais (e.g. 18990 -> "189"). Only 3+ digits, to avoid matching
  // stray small numbers.
  const reais = Math.floor(offer.priceCents / 100).toString();
  if (reais.length >= 3 && t.includes(reais)) return true;

  return false;
}

/**
 * Decide which offer to send, deterministically and safely:
 *  1. the model's explicit selection (a valid 0-based index), else
 *  2. a single unambiguous match from the customer's own message, else
 *  3. the only offer, when there is just one, else
 *  4. -1 = ambiguous (the caller should present the options and ask).
 */
export function resolveOfferIndex(
  offers: CheckoutOffer[],
  modelIndex: number | null | undefined,
  customerText: string,
): number {
  if (offers.length === 0) return -1;

  if (
    typeof modelIndex === "number" &&
    Number.isInteger(modelIndex) &&
    modelIndex >= 0 &&
    modelIndex < offers.length
  ) {
    return modelIndex;
  }

  const matches = offers
    .map((offer, index) => ({ offer, index }))
    .filter(({ offer }) => textMatchesOffer(customerText, offer));
  if (matches.length === 1) return matches[0]!.index;

  if (offers.length === 1) return 0;

  return -1;
}
