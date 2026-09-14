# VENDEIA

Sistema web privado — agente de vendas com IA para WhatsApp.

> **Estágio atual: Fundação (Etapa 1).** A estrutura, o banco de dados, a
> autenticação, as camadas de serviço, o agente de IA e os contratos de
> integração estão criados. **Nenhuma integração externa está conectada**
> (WhatsApp, Logzz e provedor de IA são contratos/placeholders).

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript** (strict)
- **Tailwind CSS v4**
- **Prisma** ORM + **PostgreSQL**
- **Auth.js v5** (credenciais, senha com hash `bcrypt`)
- **Zod** para validação de entrada

## Princípio central do agente

A IA **nunca inventa informações**. Ela só pode afirmar dados vindos de:
produto cadastrado, base de conhecimento, regras do agente, histórico da
conversa e fatos verificados retornados por integrações. Preço, prazo, estoque,
desconto, garantia e disponibilidade de entrega só são ditos com fonte
confiável.

## Arquitetura (camadas separadas)

```
src/
  app/                       Interface (App Router)
    (auth)/login             Tela de login
    (dashboard)/             Painel: dashboard, products, conversations,
                             customers, orders, knowledge, settings, integrations
    api/auth/[...nextauth]   Handler do Auth.js
    api/webhooks/whatsapp    Webhook WhatsApp (placeholder 501)
    api/webhooks/logzz       Webhook Logzz (placeholder 501)
  components/                UI reutilizável (sidebar, primitivos)
  lib/                       Utilitários + validação de env
  server/
    db/                      Cliente Prisma
    auth/                    Config Auth.js (edge + node) e hash de senha
    logger/                  Logger estruturado (sem secrets)
    services/                Regras de negócio (products, customers,
                             conversations, messages, orders, knowledge, agent)
    ai/                      AI Sales Agent (estados, contratos, orquestração)
    integrations/            IntegrationProvider + WhatsAppProvider + LogzzProvider
  types/                     Type augmentation (next-auth)
prisma/
  schema.prisma              Modelo de dados completo
  seed.ts                    Usuário admin inicial + configurações padrão
```

A camada de integração é abstrata: `MessagingProvider` (WhatsApp) e
`FulfillmentProvider` (Logzz) definem contratos; as implementações lançam
`NotImplementedError` até serem conectadas. Trocar/conectar um provedor não
exige alterar as regras de negócio.

## Como rodar localmente

1. Instale dependências:
   ```bash
   npm install
   ```
2. Copie as variáveis de ambiente e ajuste:
   ```bash
   cp .env.example .env
   # defina DATABASE_URL (PostgreSQL) e AUTH_SECRET (openssl rand -base64 32)
   ```
3. Aplique o schema e gere o client:
   ```bash
   npm run db:push
   npm run db:generate
   ```
4. Crie o usuário admin:
   ```bash
   ADMIN_EMAIL="voce@exemplo.com" ADMIN_PASSWORD="uma-senha-forte" npm run db:seed
   ```
5. Rode em desenvolvimento:
   ```bash
   npm run dev
   ```

## Scripts

| Script | Descrição |
| --- | --- |
| `npm run dev` | Ambiente de desenvolvimento |
| `npm run build` | `prisma generate` + build de produção |
| `npm run start` | Servidor de produção |
| `npm run lint` | ESLint |
| `npm run typecheck` | Checagem de tipos (`tsc --noEmit`) |
| `npm run db:push` | Aplica o schema no banco |
| `npm run db:migrate` | Cria/roda migrations |
| `npm run db:seed` | Popula o usuário admin e configurações padrão |

## Segurança

- Senhas sempre com hash (`bcrypt`, 12 rounds); nunca em texto puro.
- Secrets apenas em variáveis de ambiente; `.env` fora do versionamento.
- Entradas validadas com Zod nas camadas de serviço.
- Rotas do painel protegidas por middleware de autenticação.
- Logger com redação de chaves sensíveis; nunca registra tokens/secrets.

## Integração com WhatsApp (Cloud API)

O WhatsApp é apenas mais um canal: mensagens entram pelo webhook e passam pelo
**mesmo** `SalesAgent`/`runCustomerTurn` do console de teste.

```
Cliente → WhatsApp → Meta Cloud API → POST /api/webhooks/whatsapp
  → WhatsAppWebhookService (idempotência via IntegrationEvent)
  → Customer/Conversation → runCustomerTurn (SalesAgent → OpenAI)
  → WhatsAppProvider.sendText → Meta → Cliente
```

Toda a integração fica isolada em `src/server/integrations/whatsapp/`
(`config.ts`, `client.ts`, `whatsapp.provider.ts`, `webhook-schema.ts`) e no
serviço `src/server/services/whatsapp-webhook.service.ts`.

### Configurar o app no Meta

1. Em <https://developers.facebook.com> crie um app do tipo **Business** e
   adicione o produto **WhatsApp**.
2. Em **WhatsApp → API Setup** copie o **Phone Number ID** e o
   **WhatsApp Business Account ID**, e gere um **access token** (para produção,
   use um token de *System User* permanente em Business Settings).
3. Em **App Settings → Basic** copie o **App Secret**.
4. Em **WhatsApp → Configuration → Webhook**:
   - **Callback URL**: `https://SEU_DOMINIO/api/webhooks/whatsapp`
   - **Verify token**: exatamente o valor de `WHATSAPP_VERIFY_TOKEN`.
   - Assine o campo **messages**.

### Variáveis de ambiente (`.env`)

| Variável | Uso |
| --- | --- |
| `WHATSAPP_ACCESS_TOKEN` | Autenticação nas chamadas à Graph API (envio) |
| `WHATSAPP_PHONE_NUMBER_ID` | Número remetente |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | WABA (referência) |
| `WHATSAPP_VERIFY_TOKEN` | Handshake do webhook (GET) |
| `WHATSAPP_API_VERSION` | Versão da Graph API (padrão `v21.0`) |
| `WHATSAPP_APP_SECRET` | Verificação da assinatura `X-Hub-Signature-256` (POST) |

Sem essas variáveis o app continua funcionando: o webhook responde à
verificação e o painel mostra **Não configurado**. **Nunca** commite valores
reais — todas são variáveis de ambiente.

### Como testar

- **Sem clientes reais / sem Meta:** em **Integrações → Teste interno**, use
  "Simular mensagem recebida". Isso executa o mesmo pipeline do webhook
  (`processIncomingWhatsAppMessage`). A resposta da IA é gerada e salva; o envio
  só acontece se o WhatsApp estiver configurado.
- **Verificação do webhook:** a Meta faz um `GET` com `hub.verify_token`; o
  endpoint responde o `hub.challenge` apenas se o token bater.
- **Logs:** eventos e erros ficam em `SystemLog` (scope `whatsapp.*` /
  `webhook.whatsapp`) — sem tokens/secrets.

### Idempotência e proteção contra loop

- Cada mensagem é identificada pelo `wamid` e registrada em `IntegrationEvent`
  (constraint única `provider + externalId`); reentregas do webhook não geram
  segunda resposta.
- Eventos de `statuses` (recibos de entrega das nossas mensagens) são ignorados;
  o agente só responde a mensagens de clientes (`value.messages`).

### Áudio → transcrição → agente

Áudios do WhatsApp entram no **mesmo** pipeline do texto:

```
AUDIO → downloadMedia() → OpenAI transcription → texto
  → runCustomerTurn() (SalesAgent) → resposta em TEXTO → WhatsApp
```

O `SalesAgent` não sabe se o cliente falou ou digitou. A mensagem original é
preservada com `type = AUDIO` e a transcrição fica no próprio `Message`
(`content` = texto transcrito; `metadata.transcription = { text, model, status }`).
No console de conversas o áudio aparece como **🎤 Mensagem de áudio** com a
transcrição e o status (✓ Transcrito / ⚠ Falha).

- Modelo de transcrição: `OPENAI_TRANSCRIPTION_MODEL` (padrão
  `gpt-4o-mini-transcribe`), centralizado em
  `src/server/ai/transcription/config.ts`. Reutiliza `OPENAI_API_KEY`.
- Limite de tamanho: `WHATSAPP_AUDIO_MAX_BYTES` (padrão 16MB) — acima disso o
  áudio não é baixado e o cliente recebe uma mensagem amigável.
- O arquivo de áudio é **temporário** (Buffer em memória); nada é gravado em
  disco nem enviado a storage externo.
- Falha/vazio/formato não suportado/transcrição indisponível → o áudio é
  registrado, o cliente recebe uma mensagem amigável e a IA **não** é chamada.
- Observabilidade em `SystemLog` (scope `whatsapp.audio`), sem áudio nem
  secrets — apenas mediaId, tamanho, mime, modelo e tempos.

### Limitações deste estágio

- **Resposta é sempre em texto** — não há resposta em áudio/TTS.
- Apenas áudio é interpretado entre as mídias; imagem/documento/localização
  continuam registrados mas não processados.
- Processamento é **síncrono** no webhook (simples e seguro para baixo volume).
  O ponto de inserção de uma **fila** está documentado em
  `whatsapp-webhook.service.ts`.
- Logzz, pedidos e deploy não fazem parte deste estágio.

## Integração com Logzz

> **Auditoria (documentação oficial):** a Logzz integra por **Webhooks de saída**
> configurados no painel (o lojista **mapeia os campos** e define a URL de
> destino) e por **Checkout Personalizado / Ofertas** (a oferta é um link de
> checkout criado no painel; o cliente informa o endereço e **escolhe o dia/
> período de entrega dentro do checkout**). **Não há API REST pública** para
> criar pedidos, puxar status ou consultar disponibilidade de entrega por CEP.

Fontes: [Webhooks – Logzz](https://blog.logzz.com.br/webhooks/) ·
[Status de pedidos – Logzz](https://ajuda.logzz.com.br/en/articles/8782060-status-de-pedidos-quais-sao-e-seus-significados) ·
[Checkout Personalizado – Logzz](https://blog.logzz.com.br/como-funciona-o-checkout-personalizado-de-agendamento-de-entregas-na-logzz/) ·
[Ofertas – Logzz](https://blog.logzz.com.br/ofertas-o-que-sao-criacao-e-edicao/).

### Matriz de capacidades

| Capacidade | Oficial? | Como | Implementado |
| --- | --- | --- | --- |
| Webhook de pedido/status | **SIM** | Painel Logzz → Integrações → Webhook | ✅ `/api/webhooks/logzz` |
| Checkout / oferta (link) | **SIM** | Link criado no painel, salvo no produto | ✅ `Product.checkoutUrl` + ação `SEND_CHECKOUT` |
| Status de pedido | **SIM (push)** | Enviado via webhook | ✅ `mapLogzzStatus()` |
| Criar pedido por API | **NÃO** | Cliente conclui no checkout | ❌ retorna `unsupported` |
| Disponibilidade de entrega por CEP | **NÃO** | Confirmada no checkout | ❌ retorna `unsupported` |
| Data/período de entrega por API | **NÃO** | Escolhidos no checkout | ❌ (só chega via webhook, se mapeado) |
| Consultar pedido/status por API (pull) | **NÃO CONFIRMADO** | — | ❌ retorna `unsupported` |

### Fluxo do pedido (checkout como confirmação)

```
SalesAgent → intenção de compra → SEND_CHECKOUT (link da oferta Logzz)
  → cliente informa endereço e escolhe entrega NO checkout
  → Logzz processa o pedido
  → webhook Logzz → /api/webhooks/logzz → Order criada/atualizada
```

O agente **nunca** promete data/prazo/entrega express sem confirmação: o
guardrail exige `delivery.status = "confirmed"` no contexto verificado (que hoje
é sempre `unknown` na conversa), então ele responde *"Posso verificar isso para
você"* e conduz ao checkout.

### Configuração

- `LOGZZ_WEBHOOK_SECRET` — segredo compartilhado para autenticar o webhook.
  Como a Logzz não documenta assinatura, o lojista embute o token na URL do
  webhook (`?token=...`) ou no header `x-logzz-token`. **Não há** API url/token.
- **URL do webhook:** `https://SEU_DOMINIO/api/webhooks/logzz?token=<LOGZZ_WEBHOOK_SECRET>`
- **Mapeamento recomendado no painel Logzz** (chaves canônicas que consumimos;
  também aceitamos variações como `cliente_name`, `order_quantity`):
  `order_id`, `order_status`, `customer_name`, `customer_phone`, `product_id`,
  `order_quantity`, `order_amount`, `delivery_date`, `delivery_period`.

### Como testar

- **Sem Logzz real:** os testes usam o `LogzzProvider`/client mockados
  (`tests/services/logzz-webhook.test.ts`, `tests/api/logzz-route.test.ts`) com
  payloads baseados nos nomes de campo documentados.
- **Idempotência:** cada evento é chaveado por `externalId + status` em
  `IntegrationEvent`; reentregas do mesmo status não duplicam o pedido.
- **Logs:** `SystemLog` (scope `logzz.webhook` / `webhook.logzz`), sem secrets.

### O que NÃO é suportado (por não existir na API da Logzz)

Criação de pedido por API, consulta de disponibilidade de entrega por CEP e
consulta de status por API (pull). Esses métodos existem na interface
`FulfillmentProvider` mas retornam `{ ok: false, code: "unsupported" }` —
**nunca** são simulados.

## Configuração para produção (guia passo a passo)

Guia para colocar o VENDEIA no ar com serviços reais. Veja também
[`PRODUCTION_CHECKLIST.md`](./PRODUCTION_CHECKLIST.md). Nenhum valor real de
secret deve ir para o código — tudo em variáveis de ambiente do provedor.

1. **Banco de dados.** Crie um PostgreSQL (Neon, Supabase, Railway...). Copie a
   URL de conexão para `DATABASE_URL`. Em ambientes serverless (Vercel), use a
   **URL com pooling** que o provedor oferece, para não esgotar conexões.
   Aplique o schema: `npm run db:push` e crie o admin: `npm run db:seed`
   (defina `ADMIN_EMAIL`/`ADMIN_PASSWORD`).
2. **OpenAI.** Crie uma API key em platform.openai.com e coloque em
   `OPENAI_API_KEY`. (Opcional: `AI_MODEL`.) É a mesma chave usada na transcrição.
3. **WhatsApp.** No Meta for Developers, crie um app **Business** + produto
   **WhatsApp**. Preencha `WHATSAPP_ACCESS_TOKEN` (token permanente de System
   User), `WHATSAPP_PHONE_NUMBER_ID` e `WHATSAPP_APP_SECRET` (App Settings →
   Basic). Escolha um `WHATSAPP_VERIFY_TOKEN` (qualquer texto secreto).
4. **Transcrição.** Já funciona com a chave do passo 2. (Opcional:
   `OPENAI_TRANSCRIPTION_MODEL`, `WHATSAPP_AUDIO_MAX_BYTES`.)
5. **Logzz.** Crie a oferta/checkout no painel da Logzz e cole o link no produto
   (campo "Checkout Logzz"). Defina `LOGZZ_WEBHOOK_SECRET` (um texto secreto).
6. **Webhooks.**
   - WhatsApp: no painel da Meta, Callback URL =
     `https://SEU_DOMINIO/api/webhooks/whatsapp`, Verify token = o mesmo do
     passo 3, e assine o campo **messages**.
   - Logzz: no painel da Logzz, URL do webhook =
     `https://SEU_DOMINIO/api/webhooks/logzz?token=SEU_LOGZZ_WEBHOOK_SECRET`, e
     mapeie os campos (ver mapeamento recomendado na seção Logzz acima).
7. **Produto.** Em **Painel → Produtos → Novo produto**, cadastre nome, preço,
   descrição, checkout (Logzz), `externalId`/oferta. Em **Conhecimento**,
   preencha perguntas/respostas — o agente só usa o que estiver cadastrado.
8. **Teste ponta a ponta.**
   - Texto: mande "Oi" no WhatsApp → deve receber resposta da IA.
   - Preço: pergunte o preço → deve responder o valor cadastrado.
   - Entrega: pergunte o prazo → o agente **não** inventa; oferece o checkout.
   - Áudio: mande um áudio → é transcrito e respondido em texto.
   - Compra: diga "quero comprar" → recebe o link de checkout da oferta.
   - Pedido: conclua no checkout → o webhook cria/atualiza o pedido no painel.
9. **Troubleshooting.**
   - Verificação do webhook falha → `WHATSAPP_VERIFY_TOKEN` diferente do painel.
   - Webhook 401 → assinatura/token errado (`WHATSAPP_APP_SECRET` /
     `LOGZZ_WEBHOOK_SECRET`).
   - IA não responde → `OPENAI_API_KEY` ausente (veja o cartão **Diagnóstico**
     em Integrações; o painel mostra o que falta, sem expor secrets).
   - Áudio não transcreve → chave ausente ou formato não suportado (o cliente é
     convidado a escrever por texto).
   - Pedido não aparece → confira o mapeamento de campos do webhook na Logzz e
     os logs em `SystemLog` (scope `logzz.webhook`).

## Multi-tenant (futuro)

Single-tenant hoje. As tabelas de domínio têm `ownerId` opcional para permitir
evolução para SaaS multiusuário sem reescrita.

## Próximas etapas (não implementadas ainda)

Deploy na Vercel e refinamentos (ex.: resposta em áudio/TTS, fila para o
processamento dos webhooks). Serão feitas em prompts dedicados.
