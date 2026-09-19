import { z } from 'zod'

/**
 * One model's cumulative usage inside a `cost-state` record's `modelUsage`
 * map. Shaped nothing like `assistant.message.usage`: fields are
 * camelCase, and every one is validated as optional since these fields
 * drift between Claude Code versions.
 */
export const modelUsageSchema = z
  .object({
    inputTokens: z.number().optional(),
    outputTokens: z.number().optional(),
    cacheReadInputTokens: z.number().optional(),
    cacheCreationInputTokens: z.number().optional(),
    thinkingTokens: z.number().optional(),
    webSearchRequests: z.number().optional(),
    costUSD: z.number().optional()
  })
  .loose()

/** A validated `cost-state.modelUsage` entry for one model. */
export type ModelUsage = z.infer<typeof modelUsageSchema>
