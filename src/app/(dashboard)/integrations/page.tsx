import { Badge, Card, PageHeader } from "@/components/ui";
import { getAiProvider } from "@/server/ai/provider";
import { getTranscriptionStatus } from "@/server/ai/transcription/config";
import { getSystemHealth } from "@/server/diagnostics/health";
import { getWhatsAppStatus } from "@/server/integrations/whatsapp/config";
import { getLogzzStatus } from "@/server/integrations/logzz/config";

import { simulateInboundWhatsAppAction } from "./actions";

// Reflects live configuration (env). Never statically optimized.
export const dynamic = "force-dynamic";

const STATUS_LABEL = {
  configured: { label: "Configurado", tone: "success" as const },
  not_configured: { label: "Não configurado", tone: "warning" as const },
};

export default function IntegrationsPage() {
  const wa = getWhatsAppStatus();
  const waStatus = STATUS_LABEL[wa.status];
  const ai = getAiProvider();
  const transcription = getTranscriptionStatus();
  const logzz = getLogzzStatus();
  const health = getSystemHealth();

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Integrações"
        description="Status dos serviços externos. As credenciais ficam em variáveis de ambiente — nunca no banco nem expostas aqui."
      />

      {/* Diagnóstico (config-only, sem chamadas externas, sem secrets) */}
      <Card className="mb-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Diagnóstico</h3>
          <Badge tone={health.productionReady ? "success" : "warning"}>
            {health.productionReady
              ? "Pronto para produção"
              : "Configuração incompleta"}
          </Badge>
        </div>
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {health.checks.map((check) => (
            <li key={check.key} className="flex items-center gap-2 text-sm">
              <span className={check.configured ? "text-emerald-600" : "text-amber-600"}>
                {check.configured ? "✓" : "○"}
              </span>
              <span>{check.label}</span>
              {!check.configured && !check.requiredForProduction ? (
                <span className="text-xs text-slate-400">(opcional)</span>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>

      {/* WhatsApp */}
      <Card className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-medium">WhatsApp Business / Cloud API</h3>
            <p className="mt-0.5 text-xs text-slate-400">Canal de mensagens</p>
          </div>
          <Badge tone={waStatus.tone}>● {waStatus.label}</Badge>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">
              Phone Number ID
            </dt>
            <dd>{wa.phoneNumberIdMasked ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">
              Verificação de assinatura
            </dt>
            <dd>{wa.signatureVerification ? "Ativa" : "Inativa"}</dd>
          </div>
        </dl>

        {wa.missing.length > 0 ? (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Variáveis ausentes: {wa.missing.join(", ")}.
          </p>
        ) : null}

        <div className="mt-4 border-t pt-3 text-xs text-slate-500">
          <p>
            URL do webhook:{" "}
            <code className="rounded bg-slate-100 px-1">
              &lt;sua-url&gt;/api/webhooks/whatsapp
            </code>
          </p>
        </div>
      </Card>

      {/* Audio transcription */}
      <Card className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-medium">Transcrição de Áudio</h3>
            <p className="mt-0.5 text-xs text-slate-400">
              Áudios recebidos pelo WhatsApp podem ser transcritos
              automaticamente.
            </p>
          </div>
          <Badge tone={transcription.configured ? "success" : "warning"}>
            ● {transcription.configured ? "Configurado" : "Não configurado"}
          </Badge>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">
              Modelo
            </dt>
            <dd>{transcription.model}</dd>
          </div>
        </dl>
        {!transcription.configured ? (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Defina <code>OPENAI_API_KEY</code> para habilitar a transcrição. Sem
            ela, áudios recebidos são registrados e o cliente é convidado a
            escrever por texto.
          </p>
        ) : null}
      </Card>

      {/* Internal test tool */}
      <Card className="mb-4">
        <h3 className="font-medium">Teste interno (simular mensagem recebida)</h3>
        <p className="mt-1 text-sm text-slate-500">
          Executa exatamente o mesmo pipeline do webhook, sem depender da Meta.
          Se o WhatsApp não estiver configurado, a resposta é gerada e salva, mas
          não é entregue.
        </p>
        <form action={simulateInboundWhatsAppAction} className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              name="phone"
              required
              placeholder="Telefone (ex.: +5511999999999)"
              className="rounded-lg border px-3 py-2 text-sm"
            />
            <input
              name="name"
              placeholder="Nome (opcional)"
              className="rounded-lg border px-3 py-2 text-sm"
            />
          </div>
          <input
            name="text"
            required
            placeholder="Mensagem do cliente"
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            Simular recebimento
          </button>
        </form>
      </Card>

      {/* Other integrations */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-medium">Provedor de IA</h3>
              <p className="mt-0.5 text-xs text-slate-400">{ai.name}</p>
            </div>
            <Badge tone={ai.isConfigured() ? "success" : "warning"}>
              {ai.isConfigured() ? "Configurado" : "Não configurado"}
            </Badge>
          </div>
        </Card>
      </div>

      {/* Logzz */}
      <Card className="mt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-medium">Logzz</h3>
            <p className="mt-0.5 text-xs text-slate-400">
              Logística / Pedidos (webhook + checkout)
            </p>
          </div>
          <Badge tone={logzz.status === "configured" ? "success" : "warning"}>
            ● {logzz.status === "configured" ? "Configurado" : "Não configurado"}
          </Badge>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="text-sm">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Capacidades confirmadas
            </p>
            <ul className="mt-1 space-y-0.5">
              <li>✓ Webhook de pedidos</li>
              <li>✓ Checkout via URL (oferta)</li>
              <li>✓ Status de pedido (via webhook)</li>
            </ul>
          </div>
          <div className="text-sm">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Não disponível na API da Logzz
            </p>
            <ul className="mt-1 space-y-0.5 text-slate-500">
              <li>✗ Criar pedido por API</li>
              <li>✗ Consultar disponibilidade de entrega por CEP</li>
              <li>✗ Consultar status por API (é push via webhook)</li>
            </ul>
          </div>
        </div>

        <div className="mt-3 border-t pt-3 text-xs text-slate-500">
          <p>
            URL do webhook:{" "}
            <code className="rounded bg-slate-100 px-1">
              &lt;sua-url&gt;/api/webhooks/logzz?token=&lt;LOGZZ_WEBHOOK_SECRET&gt;
            </code>
          </p>
          {logzz.status !== "configured" ? (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
              Defina <code>LOGZZ_WEBHOOK_SECRET</code> para autenticar o webhook.
              A entrega é confirmada no checkout da Logzz — o agente nunca promete
              data/prazo sem confirmação.
            </p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
