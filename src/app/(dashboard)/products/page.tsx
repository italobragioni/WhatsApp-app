import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { formatPriceCents } from "@/lib/slug";
import { listProducts } from "@/server/services/product.service";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const products = await listProducts();

  return (
    <div>
      <PageHeader
        title="Produtos"
        description="Catálogo de produtos que o agente de IA poderá vender. O formulário de cadastro completo será adicionado na próxima etapa."
      />

      {products.length === 0 ? (
        <EmptyState
          title="Nenhum produto cadastrado"
          description="A estrutura de dados e a camada de serviço já estão prontas. O cadastro pela interface entra na próxima etapa."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <Card key={product.id}>
              <div className="flex items-start justify-between">
                <h3 className="font-medium">{product.name}</h3>
                <Badge tone={product.active ? "success" : "neutral"}>
                  {product.active ? "Ativo" : "Inativo"}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-slate-500 line-clamp-2">
                {product.description ?? "Sem descrição"}
              </p>
              <p className="mt-3 text-lg font-semibold">
                {formatPriceCents(product.priceCents, product.currency)}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
