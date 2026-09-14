import { Card, PageHeader } from "@/components/ui";
import { prisma } from "@/server/db/prisma";

// Reads live data at request time; never statically prerendered.
export const dynamic = "force-dynamic";

async function getCounts() {
  const [products, customers, conversations, orders] = await Promise.all([
    prisma.product.count(),
    prisma.customer.count(),
    prisma.conversation.count(),
    prisma.order.count(),
  ]);
  return { products, customers, conversations, orders };
}

const STATS: { key: keyof Awaited<ReturnType<typeof getCounts>>; label: string }[] =
  [
    { key: "conversations", label: "Conversas" },
    { key: "customers", label: "Clientes" },
    { key: "products", label: "Produtos" },
    { key: "orders", label: "Pedidos" },
  ];

export default async function DashboardPage() {
  const counts = await getCounts();

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Visão geral do sistema. Os indicadores completos serão ampliados nas próximas etapas."
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {STATS.map((stat) => (
          <Card key={stat.key}>
            <p className="text-sm text-slate-500">{stat.label}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">
              {counts[stat.key]}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
