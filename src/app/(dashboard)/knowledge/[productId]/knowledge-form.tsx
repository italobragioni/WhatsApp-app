"use client";

import { KnowledgeCategory } from "@prisma/client";
import { useRef, useState } from "react";
import { useActionState } from "react";

import { CharCountTextArea } from "@/components/char-count-textarea";

import {
  createKnowledgeAction,
  type KnowledgeFormState,
} from "../actions";

const CATEGORIES = Object.values(KnowledgeCategory);

export function KnowledgeForm({ productId }: { productId: string }) {
  const [state, formAction, pending] = useActionState<
    KnowledgeFormState,
    FormData
  >(createKnowledgeAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const [overFields, setOverFields] = useState<Record<string, boolean>>({});
  const anyOver = Object.values(overFields).some(Boolean);
  const onOverChange = (name: string, isOver: boolean) =>
    setOverFields((prev) => ({ ...prev, [name]: isOver }));

  return (
    <form
      ref={formRef}
      action={async (fd) => {
        await formAction(fd);
        formRef.current?.reset();
      }}
      className="space-y-3 rounded-xl border bg-white p-5"
    >
      <input type="hidden" name="productId" value={productId} />
      <h3 className="font-medium">Novo item de conhecimento</h3>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="block text-sm font-medium" htmlFor="category">
            Categoria
          </label>
          <select
            id="category"
            name="category"
            className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
            defaultValue={KnowledgeCategory.FAQ}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium" htmlFor="priority">
            Prioridade (0-100)
          </label>
          <input
            id="priority"
            name="priority"
            type="number"
            min={0}
            max={100}
            defaultValue={0}
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium" htmlFor="question">
          Pergunta
        </label>
        <input
          id="question"
          name="question"
          placeholder="Ex.: Como funciona o pagamento?"
          className="w-full rounded-lg border px-3 py-2 text-sm"
        />
      </div>

      <CharCountTextArea
        label="Resposta"
        name="answer"
        rows={3}
        placeholder="Ex.: O pagamento é realizado somente no recebimento."
        onOverChange={onOverChange}
      />

      <CharCountTextArea
        label="Conteúdo adicional (opcional)"
        name="content"
        rows={3}
        onOverChange={onOverChange}
      />

      {anyOver ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Um ou mais campos excedem 50.000 caracteres. Reduza o conteúdo para
          salvar.
        </p>
      ) : null}

      {state?.error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || anyOver}
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "Salvando..." : "Adicionar"}
      </button>
    </form>
  );
}
