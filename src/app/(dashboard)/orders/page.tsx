import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { formatPriceCents } from "@/lib/slug";
import { listOrders } from "@/server/services/order.service";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const orders = await listOrders();

  return (
    <div>
      <PageHeader
        title="Pedidos"
        description="Pedidos sincronizados a partir do webhook da Logzz (push). Criação via API não é oferecida pela Logzz."
      />

      {orders.length === 0 ? (
        <EmptyState title="Nenhum pedido registrado" />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Produto</th>
                <th className="px-4 py-3 font-medium">Valor</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Origem</th>
                <th className="px-4 py-3 font-medium">External ID</th>
                <th className="px-4 py-3 font-medium">Atualizado</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const rawSource =
                  order.metadata &&
                  typeof order.metadata === "object" &&
                  !Array.isArray(order.metadata)
                    ? (order.metadata as Record<string, unknown>).source
                    : null;
                const source =
                  rawSource === "logzz"
                    ? "LOGZZ"
                    : rawSource === "assistido"
                      ? "ASSISTIDO"
                      : "—";
                return (
                  <tr key={order.id} className="border-t">
                    <td className="px-4 py-3">
                      {order.customer.name ?? order.customer.phone}
                    </td>
                    <td className="px-4 py-3">{order.product?.name ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {formatPriceCents(order.amountCents, order.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge>{order.status}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {source !== "—" ? <Badge>{source}</Badge> : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {order.externalId ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                      {order.updatedAt.toLocaleString("pt-BR")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
