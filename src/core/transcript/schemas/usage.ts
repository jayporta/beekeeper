import { z } from 'zod'

/** The longest raw `speed` string {@link usageSchema} keeps as-is. */
const MAX_SPEED_CHARS = 32

/**
 * The sentinel `speed` value substituted for a raw value too long or the
 * wrong type to keep as-is. Never a real billing speed, so it always prices
 * as unpriced/unknown-speed, never standard.
 */
export const UNKNOWN_SPEED = 'unknown'

/**
 * Narrows a raw `speed` value to a bounded, safe-to-store string: absent
 * or `null` becomes `undefined`, a string up to {@link MAX_SPEED_CHARS}
 * long passes through unchanged, and anything else, including a longer
 * string or non-string JSON, becomes {@link UNKNOWN_SPEED}. Keeps a usage
 * record from holding arbitrary, unbounded JSON per message.
 *
 * @param value - The raw `speed` value from a transcript record.
 * @returns The narrowed speed.
 */
function narrowSpeed(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'string' && value.length <= MAX_SPEED_CHARS) return value
  return UNKNOWN_SPEED
}

/**
 * Cache-write token counts split by retention tier. Only the fields we
 * consume are validated; unknown tiers pass through unexamined.
 */
const cacheCreationSchema = z
  .object({
    ephemeral_5m_input_tokens: z.number().nonnegative().optional(),
    ephemeral_1h_input_tokens: z.number().nonnegative().optional()
  })
  .loose()

/**
 * One usage snapshot: the token counts for a single API response, or for
 * one entry in a multi-iteration `usage.iterations` array.
 */
const usageEntrySchema = z
  .object({
    input_tokens: z.number().nonnegative(),
    output_tokens: z.number().nonnegative(),
    cache_read_input_tokens: z.number().nonnegative().optional(),
    cache_creation_input_tokens: z.number().nonnegative().optional(),
    cache_creation: cacheCreationSchema.optional(),
    speed: z.unknown().transform(narrowSpeed).optional()
  })
  .loose()

/**
 * A message's full usage: one usage snapshot, plus optional per-iteration
 * snapshots when the response was produced over several model calls.
 * `iterations` carries `null` for a synthetic record's usage rather than
 * being absent.
 */
export const usageSchema = usageEntrySchema.extend({
  iterations: z.array(usageEntrySchema).nullable().optional()
})

/** A validated usage snapshot, with optional per-iteration breakdowns. */
export type Usage = z.infer<typeof usageSchema>

/** One validated usage snapshot's token counts, with no `iterations` field: the top level, or one entry in it. */
export type UsageEntry = z.infer<typeof usageEntrySchema>
