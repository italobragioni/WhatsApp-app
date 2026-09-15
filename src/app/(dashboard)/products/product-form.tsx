"use client";

import type { Product } from "@prisma/client";
import Link from "next/link";
import { useActionState, useState } from "react";

import { CharCountTextArea } from "@/components/char-count-textarea";

import type { ProductFormState } from "./actions";

function Text({
  label,
  name,
  required,
  placeholder,
  defaultValue,
}: {
  label: string;
  name: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string | null;
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
        defaultValue={defaultValue ?? ""}
        className="w-full rounded-lg border px-3 py-2 text-sm"
      />
    </div>
  );
}

function Area({
  label,
  name,
  hint,
  defaultValue,
}: {
  label: string;
  name: string;
  hint?: string;
  defaultValue?: string | null;
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
        defaultValue={defaultValue ?? ""}
        className="w-full rounded-lg border px-3 py-2 text-sm"
      />
      {hint ? <p className="text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

/** Format cents into a pt-BR decimal string for the price input (e.g. 4990 -> "49,90"). */
function priceToInput(cents: number | undefined): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

/**
 * Shared product form used for BOTH create and edit. The concrete server
 * action, initial values and labels are passed in, so there is a single form
 * implementation. Long AI-facing fields use a character counter and submit is
 * disabled while any of them exceed the limit (the server validates too).
 */
export function ProductForm({
  action,
  initialProduct,
  submitLabel,
  cancelHref,
}: {
  action: (
    state: ProductFormState,
    formData: FormData,
  ) => Promise<ProductFormState>;
  initialProduct?: Product | null;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState<
    ProductFormState,
    FormData
  >(action, undefined);

  const [overFields, setOverFields] = useState<Record<string, boolean>>({});
  const anyOver = Object.values(overFields).some(Boolean);

  const onOverChange = (name: string, isOver: boolean) =>
    setOverFields((prev) => ({ ...prev, [name]: isOver }));

  const p = initialProduct;

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-xl border bg-white p-6"
    >
      {p ? <input type="hidden" name="id" value={p.id} /> : null}

      <Text
        label="Nome"
        name="name"
        required
        placeholder="Nome do produto"
        defaultValue={p?.name}
      />
      <Text
        label="Preço (R$)"
        name="price"
        placeholder="Ex.: 49,90"
        defaultValue={priceToInput(p?.priceCents)}
      />
      <CharCountTextArea
        label="Descrição"
        name="description"
        defaultValue={p?.description}
        rows={5}
        onOverChange={onOverChange}
      />
      <Area
        label="Benefícios"
        name="benefits"
        hint="Um por linha."
        defaultValue={p?.benefits.join("\n")}
      />
      <Area
        label="Características"
        name="features"
        hint="Uma por linha."
        defaultValue={p?.features.join("\n")}
      />
      <Area
        label="Argumentos de venda"
        name="salesArguments"
        hint="Um por linha."
        defaultValue={p?.salesArguments.join("\n")}
      />
      <CharCountTextArea
        label="Garantia"
        name="warranty"
        defaultValue={p?.warranty}
        onOverChange={onOverChange}
      />
      <CharCountTextArea
        label="Informações de pagamento"
        name="paymentInfo"
        defaultValue={p?.paymentInfo}
        onOverChange={onOverChange}
      />
      <CharCountTextArea
        label="Informações de entrega"
        name="deliveryInfo"
        defaultValue={p?.deliveryInfo}
        onOverChange={onOverChange}
      />
      <Text
        label="Checkout Logzz (URL da oferta, opcional)"
        name="checkoutUrl"
        placeholder="https://entrega.logzz.com.br/..."
        defaultValue={p?.checkoutUrl}
      />
      <Text
        label="ID externo Logzz (opcional)"
        name="externalId"
        placeholder="ID do produto na Logzz"
        defaultValue={p?.externalId}
      />
      <Text
        label="Oferta Logzz (opcional)"
        name="offerId"
        placeholder="ID/identificador da oferta"
        defaultValue={p?.offerId}
      />

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="active"
          defaultChecked={p ? p.active : true}
        />
        Produto ativo
      </label>

      {anyOver ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Um ou mais campos excedem o limite de 50.000 caracteres. Reduza o
          conteúdo para salvar.
        </p>
      ) : null}

      {state?.error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || anyOver}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Salvando..." : submitLabel}
        </button>
        <Link
          href={cancelHref}
          className="rounded-lg border px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
