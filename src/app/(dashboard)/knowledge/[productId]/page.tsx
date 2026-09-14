import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { getProduct } from "@/server/services/product.service";
import { listKnowledge } from "@/server/services/knowledge.service";

import { deleteKnowledgeAction } from "../actions";
import { KnowledgeForm } from "./knowledge-form";

export const dynamic = "force-dynamic";

export default async function ProductKnowledgePage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const product = await getProduct(productId);
  if (!product) notFound();

  const items = await listKnowledge(productId);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4">
        <Link
          href="/knowledge"
          className="text-sm text-slate-500 hover:underline"
        >
          ← Conhecimento
        </Link>
      </div>
      <PageHeader
        title={`Conhecimento — ${product.name}`}
        description="Perguntas, respostas e conteúdos que o agente pode usar como fonte de verdade."
      />

      <div className="mb-6">
        <KnowledgeForm productId={productId} />
      </div>

      {items.length === 0 ? (
        <EmptyState title="Nenhum item cadastrado" />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Badge>{item.category}</Badge>
                  <span className="text-xs text-slate-400">
                    prioridade {item.priority}
                  </span>
                </div>
                <form action={deleteKnowledgeAction}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="productId" value={productId} />
                  <button
                    type="submit"
                    className="text-xs text-red-600 hover:underline"
                  >
                    Excluir
                  </button>
                </form>
              </div>
              {item.question ? (
                <p className="mt-2 text-sm font-medium">{item.question}</p>
              ) : null}
              {item.answer ? (
                <p className="text-sm text-slate-600">{item.answer}</p>
              ) : null}
              {!item.question && !item.answer ? (
                <p className="mt-2 text-sm text-slate-600">{item.content}</p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
