import Link from "next/link";

import { PageHeader } from "@/components/ui";
import { listProducts } from "@/server/services/product.service";

import { createTestConversationAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewConversationPage() {
  const products = await listProducts();
  const activeProducts = products.filter((p) => p.active);

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-4">
        <Link
          href="/conversations"
          className="text-sm text-slate-500 hover:underline"
        >
          ← Conversas
        </Link>
      </div>
      <PageHeader
        title="Nova conversa de teste"
        description="Crie um ambiente interno para conversar com o agente como se fosse um cliente."
      />

      <form
        action={createTestConversationAction}
        className="space-y-4 rounded-xl border bg-white p-4 sm:p-6"
      >
        <div className="space-y-1">
          <label htmlFor="customerName" className="block text-sm font-medium">
            Nome do cliente (opcional)
          </label>
          <input
            id="customerName"
            name="customerName"
            className="w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="Ex.: João"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="customerPhone" className="block text-sm font-medium">
            Telefone / identificador
          </label>
          <input
            id="customerPhone"
            name="customerPhone"
            required
            className="w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="Ex.: +5511999999999"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="productId" className="block text-sm font-medium">
            Produto
          </label>
          <select
            id="productId"
            name="productId"
            className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
          >
            <option value="">Nenhum</option>
            {activeProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {activeProducts.length === 0 ? (
            <p className="text-xs text-amber-700">
              Nenhum produto ativo. Você pode criar um em Produtos para um teste
              mais completo.
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 sm:w-auto sm:py-2"
        >
          Criar conversa
        </button>
      </form>
    </div>
  );
}
