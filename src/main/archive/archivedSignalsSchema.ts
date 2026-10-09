import { z } from 'zod'

/** An agent's archived signal counts, as its card and its report read them. Extra fields are tolerated. */
export const archivedSignalsSchema = z.looseObject({
  toolErrors: z.number(),
  longestErrorStreak: z.number(),
  longestBashRepeat: z.number(),
  compactions: z.number(),
  agentsKilled: z.number(),
  longestToolWait: z.looseObject({ ms: z.number(), tool: z.string() }).nullable(),
  partial: z.boolean()
})
