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
        description="Conversas com clientes. O atendimento em tempo real e o controle humano-no-loop serão construídos sobre esta base."
      />

      {conversations.length === 0 ? (
        <EmptyState title="Nenhuma conversa ainda" />
      ) : (
        <div className="space-y-3">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className="flex items-center justify-between rounded-xl border bg-white p-4"
            >
              <div>
                <p className="font-medium">
                  {conv.customer.name ?? conv.customer.phone}
                </p>
                <p className="text-sm text-slate-500">{conv.stage}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={AGENT_MODE_TONE[conv.agentMode]}>
                  {conv.agentMode}
                </Badge>
                <Badge>{conv.status}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
