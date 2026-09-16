import { describe, expect, it } from "vitest";

import { getProductOffers, resolveOfferIndex } from "@/lib/checkout";

import { makeProduct } from "../helpers";

const OPTIONS = [
  { label: "1 unidade", priceCents: 12990, url: "https://logzz.com.br/1un" },
  { label: "2 unidades", priceCents: 18990, url: "https://logzz.com.br/2un" },
];

describe("getProductOffers", () => {
  it("returns the multi-options when present", () => {
    const offers = getProductOffers(
      makeProduct({ checkoutOptions: OPTIONS, checkoutUrl: null }),
    );
    expect(offers).toHaveLength(2);
    expect(offers[1]?.url).toBe("https://logzz.com.br/2un");
  });

  it("falls back to the single checkoutUrl as one offer", () => {
    const offers = getProductOffers(
      makeProduct({ checkoutUrl: "https://logzz.com.br/x", checkoutOptions: null }),
    );
    expect(offers).toHaveLength(1);
    expect(offers[0]?.url).toBe("https://logzz.com.br/x");
  });

  it("multi-options take precedence over the single URL", () => {
    const offers = getProductOffers(
      makeProduct({ checkoutUrl: "https://logzz.com.br/x", checkoutOptions: OPTIONS }),
    );
    expect(offers).toHaveLength(2);
  });

  it("returns [] when there is no checkout at all", () => {
    expect(
      getProductOffers(makeProduct({ checkoutUrl: null, checkoutOptions: null })),
    ).toEqual([]);
  });

  it("ignores malformed options JSON", () => {
    const offers = getProductOffers(
      makeProduct({ checkoutOptions: [{ label: "x" }], checkoutUrl: null }),
    );
    expect(offers).toEqual([]);
  });
});

describe("resolveOfferIndex", () => {
  it("trusts a valid model index", () => {
    expect(resolveOfferIndex(OPTIONS, 1, "qualquer coisa")).toBe(1);
  });

  it("ignores an out-of-range model index and matches the text instead", () => {
    expect(resolveOfferIndex(OPTIONS, 9, "quero 2 unidades")).toBe(1);
  });

  it("matches the quantity in the customer message", () => {
    expect(resolveOfferIndex(OPTIONS, null, "vou querer 1 unidade")).toBe(0);
    expect(resolveOfferIndex(OPTIONS, null, "me vê duas")).toBe(1);
  });

  it("matches the price the customer mentions", () => {
    expect(resolveOfferIndex(OPTIONS, null, "quero o de 189")).toBe(1);
    expect(resolveOfferIndex(OPTIONS, null, "o de 129,90 por favor")).toBe(0);
  });

  it("returns -1 when ambiguous (multiple offers, no signal)", () => {
    expect(resolveOfferIndex(OPTIONS, null, "me manda o link")).toBe(-1);
  });

  it("defaults to the only offer when there is a single one", () => {
    expect(
      resolveOfferIndex(
        [{ label: "Comprar", priceCents: 4990, url: "https://x/y" }],
        null,
        "me manda o link",
      ),
    ).toBe(0);
  });
});
