"use client";

import { useActionState } from "react";

import { createProductAction, type ProductFormState } from "../actions";

function Text({
  label,
  name,
  required,
  placeholder,
}: {
  label: string;
  name: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="block text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-lg border px-3 py-2 text-sm"
      />
    </div>
  );
}

function Area({
  label,
  name,
  hint,
}: {
  label: string;
  name: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="block text-sm font-medium">
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        rows={3}
        className="w-full rounded-lg border px-3 py-2 text-sm"
      />
      {hint ? <p className="text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

export function ProductForm() {
  const [state, formAction, pending] = useActionState<
    ProductFormState,
    FormData
  >(createProductAction, undefined);

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-xl border bg-white p-6"
    >
      <Text label="Nome" name="name" required placeholder="Nome do produto" />
      <Text label="Preço (R$)" name="price" placeholder="Ex.: 49,90" />
      <Area label="Descrição" name="description" />
      <Area
        label="Benefícios"
        name="benefits"
        hint="Um por linha."
      />
      <Area
        label="Características"
        name="features"
        hint="Uma por linha."
      />
      <Area
        label="Argumentos de venda"
        name="salesArguments"
        hint="Um por linha."
      />
      <Area label="Garantia" name="warranty" />
      <Area label="Informações de pagamento" name="paymentInfo" />
      <Area label="Informações de entrega" name="deliveryInfo" />
      <Text
        label="Checkout Logzz (URL da oferta, opcional)"
        name="checkoutUrl"
        placeholder="https://entrega.logzz.com.br/..."
      />
      <Text
        label="ID externo Logzz (opcional)"
        name="externalId"
        placeholder="ID do produto na Logzz"
      />
      <Text
        label="Oferta Logzz (opcional)"
        name="offerId"
        placeholder="ID/identificador da oferta"
      />

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked />
        Produto ativo
      </label>

      {state?.error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "Salvando..." : "Salvar produto"}
      </button>
    </form>
  );
}
