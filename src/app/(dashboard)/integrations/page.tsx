import { Badge, Card, PageHeader } from "@/components/ui";
import { getAiProvider } from "@/server/ai/provider";
import { integrations } from "@/server/integrations";

// Static: only reflects provider configuration, no DB access.
const providers = [
  {
    name: integrations.messaging().name,
    kind: "Mensageria (WhatsApp)",
    configured: integrations.messaging().isConfigured(),
    note: "Recebimento e envio de mensagens, áudio e mídia.",
  },
  {
    name: integrations.fulfillment().name,
    kind: "Logística / Pedidos (Logzz)",
    configured: integrations.fulfillment().isConfigured(),
    note: "Disponibilidade de entrega, criação e status de pedidos.",
  },
  {
    name: getAiProvider().name,
    kind: "Provedor de IA",
    configured: getAiProvider().isConfigured(),
    note: "Geração das respostas do agente de vendas.",
  },
];

export default function IntegrationsPage() {
  return (
    <div>
      <PageHeader
        title="Integrações"
        description="Serviços externos. Os contratos já existem no código; as conexões reais serão feitas em etapas dedicadas."
      />

      <div className="grid gap-4 md:grid-cols-3">
        {providers.map((p) => (
          <Card key={p.kind}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-medium">{p.kind}</h3>
                <p className="mt-0.5 text-xs text-slate-400">{p.name}</p>
              </div>
              <Badge tone={p.configured ? "success" : "warning"}>
                {p.configured ? "Conectado" : "Não conectado"}
              </Badge>
            </div>
            <p className="mt-3 text-sm text-slate-500">{p.note}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
