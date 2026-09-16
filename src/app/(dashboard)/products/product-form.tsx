"use client";

import type { Product } from "@prisma/client";
import Link from "next/link";
import { useActionState, useState } from "react";

import { CharCountTextArea } from "@/components/char-count-textarea";
import { parseCheckoutOptions } from "@/lib/checkout";

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

interface OptionRow {
  key: string;
  label: string;
  price: string;
  url: string;
}

let optionKeySeq = 0;
const newOptionKey = () => `opt_${optionKeySeq++}`;

/**
 * Editor for MULTIPLE checkout offers (e.g. "1 unidade" R$129,90 and
 * "2 unidades" R$189,90), each with its own Logzz link. The bot detects which
 * option the customer wants and sends the matching link. Serialized as JSON into
 * a hidden `checkoutOptions` input; when empty, the single "Link único" is used.
 */
function CheckoutOptionsEditor({ initial }: { initial: OptionRow[] }) {
  const [rows, setRows] = useState<OptionRow[]>(initial);

  const update = (key: string, patch: Partial<OptionRow>) =>
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );
  const remove = (key: string) =>
    setRows((prev) => prev.filter((r) => r.key !== key));
  const add = () =>
    setRows((prev) => [
      ...prev,
      { key: newOptionKey(), label: "", price: "", url: "" },
    ]);

  const serialized = JSON.stringify(
    rows
      .filter((r) => r.label.trim() && r.url.trim())
      .map((r) => ({ label: r.label.trim(), price: r.price, url: r.url.trim() })),
  );

  return (
    <div className="space-y-3 rounded-lg border border-dashed bg-slate-50/60 p-4">
      <div>
        <p className="text-sm font-medium">Opções de checkout (vários links)</p>
        <p className="mt-0.5 text-xs text-slate-500">
          Cadastre uma opção por combo (ex.: “1 unidade” R$129,90 e “2 unidades”
          R$189,90), cada uma com seu link da Logzz. O agente identifica qual o
          cliente quer e envia o link certo. Se preenchidas, têm prioridade sobre
          o “Link único” acima.
        </p>
      </div>

      {/* Hidden field the server action reads. */}
      <input type="hidden" name="checkoutOptions" value={serialized} />

      {rows.length === 0 ? (
        <p className="text-xs text-slate-400">
          Nenhuma opção adicionada. Use o “Link único” acima, ou adicione opções
          abaixo.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((row, i) => (
            <div
              key={row.key}
              className="space-y-2 rounded-lg border bg-white p-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">
                  Opção {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => remove(row.key)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Remover
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  aria-label="Rótulo da opção"
                  placeholder="Rótulo (ex.: 2 unidades)"
                  value={row.label}
                  onChange={(e) => update(row.key, { label: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
                <input
                  aria-label="Preço da opção"
                  placeholder="Preço (ex.: 189,90)"
                  value={row.price}
                  onChange={(e) => update(row.key, { price: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
              <input
                aria-label="URL da opção"
                placeholder="https://entrega.logzz.com.br/..."
                value={row.url}
                onChange={(e) => update(row.key, { url: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={add}
        className="rounded-lg border bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50"
      >
        + Adicionar opção
      </button>
    </div>
  );
}

/** Build the initial editor rows from a product's stored checkout options. */
function initialOptionRows(product?: Product | null): OptionRow[] {
  return parseCheckoutOptions(product?.checkoutOptions).map((o) => ({
    key: newOptionKey(),
    label: o.label,
    price: priceToInput(o.priceCents),
    url: o.url,
  }));
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
      className="space-y-4 rounded-xl border bg-white p-4 sm:p-6"
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
        label="Link único de checkout (opcional)"
        name="checkoutUrl"
        placeholder="https://entrega.logzz.com.br/..."
        defaultValue={p?.checkoutUrl}
      />
      <CheckoutOptionsEditor initial={initialOptionRows(p)} />
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

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <button
          type="submit"
          disabled={pending || anyOver}
          className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60 sm:w-auto sm:py-2"
        >
          {pending ? "Salvando..." : submitLabel}
        </button>
        <Link
          href={cancelHref}
          className="w-full rounded-lg border px-4 py-2.5 text-center text-sm text-slate-600 transition hover:bg-slate-50 sm:w-auto sm:py-2"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
