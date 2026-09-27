import { z } from 'zod'

/**
 * One model's cumulative usage inside a `cost-state` record's `modelUsage`
 * map. Shaped nothing like `assistant.message.usage`: fields are
 * camelCase, and every one is validated as optional since these fields drift
 * between Claude Code versions. The fields Beekeeper reads (tokens and
 * `costUSD`) must also be non-negative. Unknown fields are kept rather than
 * stripped, since the parsed output is reduced to totals right away and never
 * retained.
 */
export const modelUsageSchema = z
  .object({
    inputTokens: z.number().nonnegative().optional(),
    outputTokens: z.number().nonnegative().optional(),
    cacheReadInputTokens: z.number().nonnegative().optional(),
    cacheCreationInputTokens: z.number().nonnegative().optional(),
    costUSD: z.number().nonnegative().optional()
  })
  .loose()

/** A validated `cost-state.modelUsage` entry for one model. */
export type ModelUsage = z.infer<typeof modelUsageSchema>
