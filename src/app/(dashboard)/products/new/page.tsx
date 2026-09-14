import Link from "next/link";

import { PageHeader } from "@/components/ui";

import { ProductForm } from "./product-form";

export default function NewProductPage() {
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
        title="Novo produto"
        description="Cadastre um produto real. O agente usará somente estas informações — nunca inventará dados."
      />
      <ProductForm />
    </div>
  );
}
