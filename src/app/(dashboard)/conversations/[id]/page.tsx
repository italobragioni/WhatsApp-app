import { AgentMode } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui";
import { formatPriceCents } from "@/lib/slug";
import { isAiConfigured } from "@/server/ai/config";
import { getConversationWithMessages } from "@/server/services/conversation.service";
import { listOrdersByCustomer } from "@/server/services/order.service";

import { setModeAction } from "../actions";
import { SendMessageForm } from "./send-message-form";

export const dynamic = "force-dynamic";

const AGENT_MODE_TONE = {
  ACTIVE: "success",
  PAUSED: "warning",
  HUMAN: "danger",
} as const;

/** Render text with clickable http(s) links (used for checkout links, etc.). */
function LinkifiedText({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <p className="whitespace-pre-wrap text-sm">
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-700 underline break-all"
          >
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </p>
  );
}

const SENDER_LABEL: Record<string, string> = {
  CUSTOMER: "Cliente",
  AGENT: "IA",
  HUMAN: "Humano",
  SYSTEM: "Sistema",
};

function ModeButton({
  conversationId,
  mode,
  label,
  current,
}: {
  conversationId: string;
  mode: AgentMode;
  label: string;
  current: AgentMode;
}) {
  const active = current === mode;
  return (
    <form action={setModeAction}>
      <input type="hidden" name="conversationId" value={conversationId} />
      <input type="hidden" name="mode" value={mode} />
      <button
        type="submit"
        disabled={active}
        className={`rounded-lg border px-3 py-1.5 text-sm transition ${
          active
            ? "cursor-default bg-slate-100 text-slate-400"
            : "text-slate-700 hover:bg-slate-50"
        }`}
      >
        {label}
      </button>
    </form>
  );
}

function AgentMeta({ metadata }: { metadata: unknown }) {
  if (!metadata || typeof metadata !== "object") return null;
  const m = metadata as Record<string, unknown>;
  const intent = typeof m.intent === "string" ? m.intent : null;
  const actions = Array.isArray(m.actions)
    ? (m.actions as Array<{ type?: string }>)
    : [];
  const actionTypes = actions
    .map((a) => a?.type)
    .filter((t): t is string => typeof t === "string" && t !== "SEND_TEXT");

  if (!intent && actionTypes.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {intent ? <Badge>{intent}</Badge> : null}
      {actionTypes.map((t) => (
        <Badge key={t} tone="warning">
          {t}
        </Badge>
      ))}
    </div>
  );
}

/** Render an inbound audio message: transcription + status. */
function AudioMessage({
  metadata,
  content,
}: {
  metadata: unknown;
  content: string;
}) {
  const m =
    metadata && typeof metadata === "object"
      ? (metadata as Record<string, unknown>)
      : {};
  const transcription =
    m.transcription && typeof m.transcription === "object"
      ? (m.transcription as Record<string, unknown>)
      : {};
  const status = typeof transcription.status === "string" ? transcription.status : "";
  const text =
    typeof transcription.text === "string" && transcription.text
      ? transcription.text
      : content && content !== "[áudio]"
        ? content
        : null;

  const statusBadge =
    status === "completed" ? (
      <Badge tone="success">✓ Transcrito</Badge>
    ) : status === "failed" ? (
      <Badge tone="danger">⚠ Falha na transcrição</Badge>
    ) : (
      <Badge tone="warning">⏳ Processando</Badge>
    );

  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="text-sm">🎤 Mensagem de áudio</span>
        {statusBadge}
      </div>
      {text ? (
        <p className="mt-1 text-sm">
          <span className="text-xs uppercase tracking-wide text-slate-400">
            Transcrição:
          </span>
          <br />
          {text}
        </p>
      ) : null}
    </div>
  );
}

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const conversation = await getConversationWithMessages(id);
  if (!conversation) notFound();

  const { customer, product, messages, agentMode, stage, channel } =
    conversation;
  const humanControlled = agentMode !== AgentMode.ACTIVE;
  const orders = await listOrdersByCustomer(customer.id);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4">
        <Link
          href="/conversations"
          className="text-sm text-slate-500 hover:underline"
        >
          ← Conversas
        </Link>
      </div>

      {/* Header */}
      <div className="mb-4 rounded-xl border bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold">
                {customer.name ?? customer.phone}
              </h1>
              <Badge>{channel}</Badge>
            </div>
            <p className="text-sm text-slate-500">
              {customer.phone}
              {product ? ` · Produto: ${product.name}` : " · Sem produto"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{stage}</Badge>
            <Badge tone={AGENT_MODE_TONE[agentMode]}>Modo: {agentMode}</Badge>
            {product ? (
              <Badge tone={product.checkoutUrl ? "success" : "warning"}>
                {product.checkoutUrl ? "Checkout ✓" : "Sem checkout"}
              </Badge>
            ) : (
              <Badge tone="warning">Sem produto</Badge>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
          <ModeButton
            conversationId={id}
            mode={AgentMode.ACTIVE}
            label="Reativar IA"
            current={agentMode}
          />
          <ModeButton
            conversationId={id}
            mode={AgentMode.PAUSED}
            label="Pausar IA"
            current={agentMode}
          />
          <ModeButton
            conversationId={id}
            mode={AgentMode.HUMAN}
            label="Assumir (humano)"
            current={agentMode}
          />
        </div>
      </div>

      {orders.length > 0 ? (
        <div className="mb-4 rounded-xl border bg-white p-4">
          <p className="mb-2 text-sm font-medium">Pedidos</p>
          <div className="space-y-2">
            {orders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between text-sm"
              >
                <span>
                  {order.externalId ? `Pedido #${order.externalId}` : "Pedido"}
                  {order.product ? ` · ${order.product.name}` : ""}
                  {" · "}
                  {formatPriceCents(order.amountCents, order.currency)}
                </span>
                <Badge>{order.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!isAiConfigured() ? (
        <div className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Provedor de IA não configurado. Defina <code>OPENAI_API_KEY</code> no
          ambiente para receber respostas da IA. As mensagens do cliente
          continuam sendo salvas normalmente.
        </div>
      ) : null}

      {/* Messages */}
      <div className="mb-4 space-y-3">
        {messages.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-white/60 p-8 text-center text-sm text-slate-500">
            Nenhuma mensagem ainda. Simule uma mensagem do cliente abaixo.
          </p>
        ) : (
          messages.map((msg) => {
            const isCustomer = msg.sender === "CUSTOMER";
            return (
              <div
                key={msg.id}
                className={`flex ${isCustomer ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                    isCustomer
                      ? "bg-white border"
                      : msg.sender === "AGENT"
                        ? "bg-brand-50"
                        : "bg-slate-100"
                  }`}
                >
                  <p className="text-xs font-medium text-slate-400">
                    {SENDER_LABEL[msg.sender] ?? msg.sender}
                  </p>
                  {msg.type === "AUDIO" ? (
                    <AudioMessage metadata={msg.metadata} content={msg.content} />
                  ) : (
                    <LinkifiedText text={msg.content} />
                  )}
                  {msg.sender === "AGENT" ? (
                    <AgentMeta metadata={msg.metadata} />
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Composer */}
      <div className="rounded-xl border bg-white p-4">
        <SendMessageForm conversationId={id} disabled={humanControlled} />
        <p className="mt-2 text-xs text-slate-400">
          Console de teste interno. A mensagem é tratada como vinda do cliente.
        </p>
      </div>
    </div>
  );
}
