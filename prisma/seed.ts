import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

/**
 * Seed script. Creates the initial admin user and default agent settings.
 *
 * Credentials come from env vars so no secret is hardcoded:
 *   ADMIN_EMAIL, ADMIN_PASSWORD  (falling back to safe local-only defaults).
 *
 * Run with: npm run db:seed  (requires a reachable DATABASE_URL).
 */
const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "admin@vendeia.local").toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "changeme123";
  const name = process.env.ADMIN_NAME ?? "Administrador";

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name, passwordHash, role: UserRole.ADMIN },
  });

  const existingSettings = await prisma.agentSettings.findFirst({
    where: { ownerId: null },
  });
  if (!existingSettings) {
    await prisma.agentSettings.create({
      data: {
        personality: "Consultivo, cordial e objetivo.",
        tone: "Profissional e amigável.",
        rules: [
          "Nunca inventar preço, prazo, estoque, desconto ou disponibilidade.",
          "Só afirmar informações com fonte confiável (produto, conhecimento ou integração).",
        ],
        objectives: [
          "Entender a necessidade do cliente.",
          "Conduzir o cliente até a compra com honestidade.",
        ],
        handoffRules: [
          "Transferir para humano quando o cliente solicitar.",
          "Transferir em caso de reclamação grave ou dúvida sem resposta na base.",
        ],
      },
    });
  }

  console.log(`Seed complete. Admin user: ${user.email}`);
  if (!process.env.ADMIN_PASSWORD) {
    console.log(
      "WARNING: used the default password 'changeme123'. Set ADMIN_PASSWORD and re-run in production.",
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
