import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui";
import { getProduct } from "@/server/services/product.service";

import { updateProductAction } from "../../actions";
import { ProductForm } from "../../product-form";

export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) notFound();

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-4">
        <Link
          href="/products"
          className="text-sm text-slate-500 hover:underline"
        >
          ← Produtos
        </Link>
      </div>
      <PageHeader
        title="Editar produto"
        description="Atualize os dados do produto. O agente usará somente estas informações."
      />
      <ProductForm
        action={updateProductAction}
        initialProduct={product}
        submitLabel="Salvar alterações"
        cancelHref="/products"
      />
    </div>
  );
}
