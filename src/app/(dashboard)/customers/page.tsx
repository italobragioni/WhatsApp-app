import { EmptyState, PageHeader } from "@/components/ui";
import { listCustomers } from "@/server/services/customer.service";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const customers = await listCustomers();

  return (
    <div>
      <PageHeader
        title="Clientes"
        description="Base de clientes. Serão criados automaticamente a partir das conversas do WhatsApp quando a integração estiver ativa."
      />

      {customers.length === 0 ? (
        <EmptyState title="Nenhum cliente cadastrado" />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Telefone</th>
                <th className="px-4 py-3 font-medium">Cidade</th>
                <th className="px-4 py-3 font-medium">UF</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="px-4 py-3">{c.name ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3">{c.phone}</td>
                  <td className="px-4 py-3">{c.city ?? "—"}</td>
                  <td className="px-4 py-3">{c.state ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
