"use client";

import { useEffect, useRef } from "react";
import { useActionState } from "react";

import { sendMessageAction, type SendState } from "../actions";

export function SendMessageForm({
  conversationId,
  disabled,
}: {
  conversationId: string;
  disabled: boolean;
}) {
  const [state, formAction, pending] = useActionState<SendState, FormData>(
    sendMessageAction,
    undefined,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.status === "ok") {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-2">
      <input type="hidden" name="conversationId" value={conversationId} />
      <div className="flex gap-2">
        <input
          name="text"
          autoComplete="off"
          placeholder={
            disabled
              ? "IA pausada/humano — reative para simular o cliente com resposta da IA"
              : "Escreva como o cliente..."
          }
          className="flex-1 rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          required
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Enviando..." : "Enviar"}
        </button>
      </div>
      {state && state.status !== "ok" && state.message ? (
        <p
          className={`text-sm ${
            state.status === "error" ? "text-red-700" : "text-amber-700"
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
