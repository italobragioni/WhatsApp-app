import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    product: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

const {
  productInputSchema,
  createProduct,
  updateProduct,
  getProduct,
} = await import("@/server/services/product.service");
const { prisma } = await import("@/server/db/prisma");

const findUnique = vi.mocked(prisma.product.findUnique);
const create = vi.mocked(prisma.product.create);
const update = vi.mocked(prisma.product.update);

function baseInput(overrides: Record<string, unknown> = {}) {
  return { name: "Produto X", priceCents: 4990, ...overrides };
}

beforeEach(() => vi.clearAllMocks());

describe("productInputSchema — long-text limits (50.000)", () => {
  it("A) accepts a 5.000-char description", () => {
    const r = productInputSchema.safeParse(
      baseInput({ description: "a".repeat(5000) }),
    );
    expect(r.success).toBe(true);
  });

  it("B) accepts a 50.000-char description", () => {
    const r = productInputSchema.safeParse(
      baseInput({ description: "a".repeat(50000) }),
    );
    expect(r.success).toBe(true);
  });

  it("C) rejects a 50.001-char description", () => {
    const r = productInputSchema.safeParse(
      baseInput({ description: "a".repeat(50001) }),
    );
    expect(r.success).toBe(false);
  });

  it("also allows 50.000 chars for warranty/paymentInfo/deliveryInfo", () => {
    const big = "b".repeat(50000);
    const r = productInputSchema.safeParse(
      baseInput({ warranty: big, paymentInfo: big, deliveryInfo: big }),
    );
    expect(r.success).toBe(true);
  });

  it("keeps short fields short (externalId max 120 still enforced)", () => {
    const r = productInputSchema.safeParse(
      baseInput({ externalId: "x".repeat(121) }),
    );
    expect(r.success).toBe(false);
  });
});

describe("updateProduct (edit)", () => {
  it("D/F) updates the existing product by ID and preserves it", async () => {
    findUnique.mockResolvedValue(null); // slug is free
    update.mockResolvedValue({ id: "prod_1" } as never);

    await updateProduct("prod_1", baseInput({ name: "Novo Nome" }));

    expect(update).toHaveBeenCalledTimes(1);
    const arg = update.mock.calls[0]![0] as {
      where: { id: string };
      data: Record<string, unknown>;
    };
    expect(arg.where).toEqual({ id: "prod_1" });
    // G) the ID is never part of the mutated data (not editable)
    expect(arg.data).not.toHaveProperty("id");
    expect(arg.data).not.toHaveProperty("createdAt");
  });

  it("E) never creates a second product when editing", async () => {
    findUnique.mockResolvedValue(null);
    update.mockResolvedValue({ id: "prod_1" } as never);

    await updateProduct("prod_1", baseInput());

    expect(create).not.toHaveBeenCalled();
  });
});

describe("createProduct / getProduct", () => {
  it("creates a product (create path still works)", async () => {
    findUnique.mockResolvedValue(null);
    create.mockResolvedValue({ id: "new_1" } as never);

    await createProduct(baseInput());

    expect(create).toHaveBeenCalledTimes(1);
    expect(update).not.toHaveBeenCalled();
  });

  it("H) an existing product can still be fetched", async () => {
    findUnique.mockResolvedValue({ id: "prod_1", name: "Produto X" } as never);
    const p = await getProduct("prod_1");
    expect(p?.id).toBe("prod_1");
  });
});
