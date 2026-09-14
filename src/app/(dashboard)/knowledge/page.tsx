import Link from "next/link";

import { Card, EmptyState, PageHeader } from "@/components/ui";
import { listProducts } from "@/server/services/product.service";

export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  const products = await listProducts();

  return (
    <div>
      <PageHeader
        title="Base de conhecimento"
        description="Conteúdo curado que o agente pode usar para responder. É a única fonte de verdade da IA — ela nunca deve inventar informações fora daqui."
      />

      {products.length === 0 ? (
        <EmptyState
          title="Cadastre um produto primeiro"
          description="A base de conhecimento é vinculada a cada produto. O editor de conhecimento entra na próxima etapa."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {products.map((product) => (
            <Link key={product.id} href={`/knowledge/${product.id}`}>
              <Card className="transition hover:bg-slate-50">
                <h3 className="font-medium">{product.name}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Gerenciar perguntas, objeções e argumentos →
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
