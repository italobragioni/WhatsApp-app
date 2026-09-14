import { Card, PageHeader } from "@/components/ui";
import { getAgentSettings } from "@/server/services/agent-settings.service";

export const dynamic = "force-dynamic";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm">{value}</p>
    </div>
  );
}

export default async function SettingsPage() {
  const settings = await getAgentSettings();

  return (
    <div>
      <PageHeader
        title="Configurações do agente"
        description="Personalidade, tom, regras e objetivos do agente de IA. A edição pela interface entra em uma próxima etapa."
      />

      <Card className="max-w-2xl space-y-4">
        {settings ? (
          <>
            <Field label="Personalidade" value={settings.personality} />
            <Field label="Tom" value={settings.tone} />
            <Field
              label="Regras"
              value={
                settings.rules.length ? settings.rules.join(" • ") : "—"
              }
            />
            <Field
              label="Objetivos"
              value={
                settings.objectives.length
                  ? settings.objectives.join(" • ")
                  : "—"
              }
            />
            <Field
              label="Regras de transferência para humano"
              value={
                settings.handoffRules.length
                  ? settings.handoffRules.join(" • ")
                  : "—"
              }
            />
          </>
        ) : (
          <p className="text-sm text-slate-500">
            Nenhuma configuração salva ainda. O agente usará valores padrão
            seguros até ser configurado.
          </p>
        )}
      </Card>
    </div>
  );
}
