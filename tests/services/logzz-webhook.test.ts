import { OrderStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { NormalizedLogzzOrderEvent } from "@/server/integrations/logzz/webhook-schema";

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    integrationEvent: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    order: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    product: { findFirst: vi.fn() },
  },
}));
vi.mock("@/server/services/customer.service", () => ({
  upsertCustomerByPhone: vi.fn(),
}));

const { processLogzzOrderEvent } = await import(
  "@/server/services/logzz-webhook.service"
);
const { prisma } = await import("@/server/db/prisma");
const { upsertCustomerByPhone } = await import(
  "@/server/services/customer.service"
);

const evFind = vi.mocked(prisma.integrationEvent.findUnique);
const evCreate = vi.mocked(prisma.integrationEvent.create);
const evUpdate = vi.mocked(prisma.integrationEvent.update);
const orderFind = vi.mocked(prisma.order.findFirst);
const orderCreate = vi.mocked(prisma.order.create);
const orderUpdate = vi.mocked(prisma.order.update);
const productFind = vi.mocked(prisma.product.findFirst);
const upsertCustomer = vi.mocked(upsertCustomerByPhone);

function event(overrides: Partial<NormalizedLogzzOrderEvent> = {}): NormalizedLogzzOrderEvent {
  return {
    externalId: "LZ-1",
    rawStatus: "Agendado",
    customerPhone: "+5511999999999",
    customerName: "João",
    productExternalId: "P1",
    quantity: 1,
    amountCents: 4990,
    raw: {},
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  evUpdate.mockResolvedValue({} as never);
  upsertCustomer.mockResolvedValue({ id: "cust1" } as never);
});

describe("processLogzzOrderEvent", () => {
  it("creates a new order, associating customer and product, with mapped status", async () => {
    evFind.mockResolvedValue(null);
    evCreate.mockResolvedValue({ id: "ev1" } as never);
    orderFind.mockResolvedValue(null);
    productFind.mockResolvedValue({ id: "prod1" } as never);
    orderCreate.mockResolvedValue({ id: "ord1" } as never);

    const result = await processLogzzOrderEvent(event());

    expect(upsertCustomer).toHaveBeenCalledWith("+5511999999999", { name: "João" });
    expect(orderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerId: "cust1",
          productId: "prod1",
          externalId: "LZ-1",
          status: OrderStatus.PLACED,
        }),
      }),
    );
    expect(result).toEqual({ status: "ok", orderId: "ord1", created: true });
    expect(evUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ processed: true }) }),
    );
  });

  it("updates an existing order matched by external id", async () => {
    evFind.mockResolvedValue(null);
    evCreate.mockResolvedValue({ id: "ev1" } as never);
    orderFind.mockResolvedValue({ id: "ord1", metadata: {} } as never);
    orderUpdate.mockResolvedValue({ id: "ord1" } as never);

    const result = await processLogzzOrderEvent(event({ rawStatus: "Entregue" }));

    expect(orderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ord1" },
        data: expect.objectContaining({ status: OrderStatus.DELIVERED }),
      }),
    );
    expect(orderCreate).not.toHaveBeenCalled();
    expect(result).toEqual({ status: "ok", orderId: "ord1", created: false });
  });

  it("skips an already-processed (duplicate) event", async () => {
    evFind.mockResolvedValue({ id: "ev1", processed: true } as never);

    const result = await processLogzzOrderEvent(event());

    expect(result).toEqual({ status: "duplicate" });
    expect(orderFind).not.toHaveBeenCalled();
    expect(orderCreate).not.toHaveBeenCalled();
  });

  it("records but does not create an order when there is no customer phone", async () => {
    evFind.mockResolvedValue(null);
    evCreate.mockResolvedValue({ id: "ev1" } as never);
    orderFind.mockResolvedValue(null);

    const result = await processLogzzOrderEvent(
      event({ customerPhone: undefined }),
    );

    expect(result).toEqual({ status: "skipped", reason: "no_customer" });
    expect(orderCreate).not.toHaveBeenCalled();
    expect(evUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ processed: true }) }),
    );
  });
});
