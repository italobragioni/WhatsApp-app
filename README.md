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

## Multi-tenant (futuro)

Single-tenant hoje. As tabelas de domínio têm `ownerId` opcional para permitir
evolução para SaaS multiusuário sem reescrita.

## Próximas etapas (não implementadas ainda)

Integração real com WhatsApp, Logzz e provedor de IA; formulários de cadastro;
atendimento em tempo real; transcrição de áudio; deploy. Serão feitas em prompts
dedicados.
