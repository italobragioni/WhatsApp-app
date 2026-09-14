import type { AgentSettings } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/server/db/prisma";

/**
 * Agent behavior configuration. Single-tenant today: we keep one global row
 * (ownerId = null). The unique constraint on ownerId makes this safe to evolve
 * per-owner later.
 */

export const agentSettingsInputSchema = z.object({
  personality: z.string().min(1).max(2000),
  tone: z.string().min(1).max(500),
  rules: z.array(z.string().min(1)).default([]),
  objectives: z.array(z.string().min(1)).default([]),
  handoffRules: z.array(z.string().min(1)).default([]),
});

export type AgentSettingsInput = z.input<typeof agentSettingsInputSchema>;

/** Fetch the (single) agent settings row if it exists. */
export async function getAgentSettings(): Promise<AgentSettings | null> {
  return prisma.agentSettings.findFirst({ where: { ownerId: null } });
}

/** Create or update the global agent settings. */
export async function saveAgentSettings(
  input: AgentSettingsInput,
): Promise<AgentSettings> {
  const data = agentSettingsInputSchema.parse(input);
  const existing = await getAgentSettings();
  if (existing) {
    return prisma.agentSettings.update({
      where: { id: existing.id },
      data,
    });
  }
  return prisma.agentSettings.create({ data });
}
