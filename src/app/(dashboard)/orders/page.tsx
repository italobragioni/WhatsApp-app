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
        description="Pedidos gerados pelo agente. A criação e o acompanhamento via Logzz serão integrados posteriormente."
      />

      {orders.length === 0 ? (
        <EmptyState title="Nenhum pedido registrado" />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Produto</th>
                <th className="px-4 py-3 font-medium">Valor</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-t">
                  <td className="px-4 py-3">
                    {order.customer.name ?? order.customer.phone}
                  </td>
                  <td className="px-4 py-3">{order.product?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    {formatPriceCents(order.amountCents, order.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge>{order.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
