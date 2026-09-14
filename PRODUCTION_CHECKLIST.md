# VENDEIA — Checklist de produção

Marque cada item antes de colocar no ar. Nunca commite valores reais de
secrets — tudo fica em variáveis de ambiente do provedor (ex.: Vercel).

## Variáveis de ambiente

Classificação:
- **OBRIGATÓRIA** — o app não sobe sem ela.
- **PRODUÇÃO** — necessária para o fluxo real funcionar em produção.
- **OPCIONAL** — tem default seguro ou degrada com elegância.

| Variável | Classe | Observação |
| --- | --- | --- |
| `DATABASE_URL` | OBRIGATÓRIA | PostgreSQL. Em serverless, use uma URL **com pooling** (PgBouncer/Neon/Supabase pooler). |
| `AUTH_SECRET` | OBRIGATÓRIA | `openssl rand -base64 32`. |
| `OPENAI_API_KEY` | PRODUÇÃO | Sem ela o agente não responde e áudios não são transcritos (app não quebra). |
| `AI_MODEL` | OPCIONAL | Default `gpt-4o-mini`. |
| `OPENAI_TRANSCRIPTION_MODEL` | OPCIONAL | Default `gpt-4o-mini-transcribe`. Reusa `OPENAI_API_KEY`. |
| `WHATSAPP_ACCESS_TOKEN` | PRODUÇÃO | Token do System User (permanente). |
| `WHATSAPP_PHONE_NUMBER_ID` | PRODUÇÃO | Número remetente. |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | OPCIONAL | Referência (WABA). |
| `WHATSAPP_VERIFY_TOKEN` | PRODUÇÃO | Deve bater com o "Verify token" do webhook na Meta. |
| `WHATSAPP_API_VERSION` | OPCIONAL | Default `v21.0`. |
| `WHATSAPP_APP_SECRET` | PRODUÇÃO | Habilita verificação de assinatura `X-Hub-Signature-256`. |
| `WHATSAPP_AUDIO_MAX_BYTES` | OPCIONAL | Default 16MB. |
| `LOGZZ_WEBHOOK_SECRET` | PRODUÇÃO (p/ sincronizar pedidos) | Autentica o webhook da Logzz. |

## Checklist

- [ ] `DATABASE_URL` configurada (com pooling para serverless)
- [ ] `AUTH_SECRET` configurada
- [ ] `OPENAI_API_KEY` configurada
- [ ] `AI_MODEL` definida (ou usando default)
- [ ] `OPENAI_TRANSCRIPTION_MODEL` definida (ou usando default)
- [ ] Credenciais do WhatsApp (`ACCESS_TOKEN`, `PHONE_NUMBER_ID`)
- [ ] Webhook da Meta configurado (Callback URL + campo `messages`)
- [ ] `WHATSAPP_VERIFY_TOKEN` igual ao configurado na Meta
- [ ] `WHATSAPP_APP_SECRET` definida (assinatura ativa)
- [ ] Checkout Logzz (oferta) criado e salvo no produto (`checkoutUrl`)
- [ ] Webhook da Logzz configurado com `?token=<LOGZZ_WEBHOOK_SECRET>`
- [ ] Produto cadastrado (nome, preço, checkout, `externalId`/`offerId`)
- [ ] Base de conhecimento do produto preenchida
- [ ] Migração aplicada no banco: `npm run db:push` (ou `db:migrate`)
- [ ] Usuário admin criado: `npm run db:seed`
- [ ] Teste — texto (cliente manda "Oi" e recebe resposta)
- [ ] Teste — áudio (cliente manda áudio, é transcrito, recebe resposta)
- [ ] Teste — checkout (link abre, produto/preço corretos)
- [ ] Teste — webhook de pedido Logzz (cria/atualiza Order)
- [ ] Teste — status do pedido (status muda conforme webhook)
- [ ] Secrets verificados (nenhum aparece em logs/UI)
- [ ] Logs verificados (`SystemLog`, scopes `whatsapp.*` / `logzz.*`)
- [ ] Build verificado (`npm run build`)
- [ ] Diagnóstico em **Integrações** mostra "Pronto para produção"

## Verificação rápida (sem chamadas externas)

Abra **Painel → Integrações**. O cartão **Diagnóstico** mostra, sem expor
nenhum secret, o que está configurado. "Pronto para produção" exige: banco,
auth, OpenAI e WhatsApp configurados.
