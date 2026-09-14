import Link from "next/link";

import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { listConversations } from "@/server/services/conversation.service";

export const dynamic = "force-dynamic";

const AGENT_MODE_TONE = {
  ACTIVE: "success",
  PAUSED: "warning",
  HUMAN: "danger",
} as const;

export default async function ConversationsPage() {
  const conversations = await listConversations();

  return (
    <div>
      <PageHeader
        title="Conversas"
        description="Console interno de testes do agente. Crie uma conversa e converse como se fosse o cliente."
        action={
          <Link
            href="/conversations/new"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            Nova conversa de teste
          </Link>
        }
      />

      {conversations.length === 0 ? (
        <EmptyState
          title="Nenhuma conversa ainda"
          description="Clique em “Nova conversa de teste” para simular um cliente."
        />
      ) : (
        <div className="space-y-3">
          {conversations.map((conv) => (
            <Link
              key={conv.id}
              href={`/conversations/${conv.id}`}
              className="flex items-center justify-between gap-3 rounded-xl border bg-white p-4 transition hover:bg-slate-50"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium">
                    {conv.customer.name ?? conv.customer.phone}
                  </p>
                  <Badge>{conv.channel}</Badge>
                </div>
                <p className="truncate text-sm text-slate-500">
                  {conv.customer.phone} · {conv.stage}
                  {conv.product ? ` · ${conv.product.name}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <div className="flex items-center gap-2">
                  <Badge tone={AGENT_MODE_TONE[conv.agentMode]}>
                    {conv.agentMode}
                  </Badge>
                  <Badge>{conv.status}</Badge>
                </div>
                {conv.lastMessageAt ? (
                  <span className="text-xs text-slate-400">
                    {conv.lastMessageAt.toLocaleString("pt-BR")}
                  </span>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
