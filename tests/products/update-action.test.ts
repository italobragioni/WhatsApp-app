import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/auth", () => ({ auth: vi.fn() }));
vi.mock("@/server/services/product.service", () => ({
  getProduct: vi.fn(),
  updateProduct: vi.fn(),
  createProduct: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error("REDIRECT:" + path);
  }),
}));

const { updateProductAction } = await import(
  "@/app/(dashboard)/products/actions"
);
const { auth } = await import("@/server/auth");
const { getProduct, updateProduct, createProduct } = await import(
  "@/server/services/product.service"
);

const authMock = vi.mocked(auth);
const getProductMock = vi.mocked(getProduct);
const updateMock = vi.mocked(updateProduct);
const createMock = vi.mocked(createProduct);

function formFor(id: string): FormData {
  const fd = new FormData();
  fd.set("id", id);
  fd.set("name", "Produto Editado");
  fd.set("price", "59,90");
  fd.set("description", "nova descrição");
  return fd;
}

beforeEach(() => vi.clearAllMocks());

describe("updateProductAction", () => {
  it("requires authentication (redirects to /login, no update)", async () => {
    authMock.mockResolvedValue(null as never);
    await expect(updateProductAction(undefined, formFor("prod_1"))).rejects.toThrow(
      "REDIRECT:/login",
    );
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("updates by ID, preserves currency + AI topics, and never creates", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never);
    getProductMock.mockResolvedValue({
      id: "prod_1",
      currency: "USD",
      aiAllowedTopics: ["pode-falar"],
      aiForbiddenTopics: ["nao-pode"],
    } as never);
    updateMock.mockResolvedValue({ id: "prod_1" } as never);

    await expect(
      updateProductAction(undefined, formFor("prod_1")),
    ).rejects.toThrow("REDIRECT:/products");

    expect(createMock).not.toHaveBeenCalled();
    expect(updateMock).toHaveBeenCalledTimes(1);
    const [id, input] = updateMock.mock.calls[0]!;
    expect(id).toBe("prod_1");
    expect(input).toMatchObject({
      name: "Produto Editado",
      currency: "USD", // preserved from existing product
      aiAllowedTopics: ["pode-falar"], // preserved
      aiForbiddenTopics: ["nao-pode"], // preserved
    });
  });

  it("returns an error when the product does not exist", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never);
    getProductMock.mockResolvedValue(null);

    const result = await updateProductAction(undefined, formFor("missing"));
    expect(result).toEqual({ error: "Produto não encontrado." });
    expect(updateMock).not.toHaveBeenCalled();
  });
});
