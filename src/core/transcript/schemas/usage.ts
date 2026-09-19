import { z } from 'zod'

/**
 * Cache-write token counts split by retention tier. Only the fields we
 * consume are validated; unknown tiers pass through unexamined.
 */
const cacheCreationSchema = z
  .object({
    ephemeral_5m_input_tokens: z.number().optional(),
    ephemeral_1h_input_tokens: z.number().optional()
  })
  .loose()

/**
 * One usage snapshot: the token counts for a single API response, or for
 * one entry in a multi-iteration `usage.iterations` array.
 */
const usageEntrySchema = z
  .object({
    input_tokens: z.number(),
    output_tokens: z.number(),
    cache_read_input_tokens: z.number().optional(),
    cache_creation_input_tokens: z.number().optional(),
    cache_creation: cacheCreationSchema.optional(),
    speed: z.unknown().optional()
  })
  .loose()

/**
 * A message's full usage: one usage snapshot, plus optional per-iteration
 * snapshots when the response was produced over several model calls.
 */
export const usageSchema = usageEntrySchema.extend({
  iterations: z.array(usageEntrySchema).optional()
})

/** A validated usage snapshot, with optional per-iteration breakdowns. */
export type Usage = z.infer<typeof usageSchema>
