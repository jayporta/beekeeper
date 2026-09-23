import { z } from 'zod'
import { modelUsageSchema } from './modelUsage'

/**
 * A `cost-state` transcript record: a cumulative cost snapshot written at
 * session exit, so a live or crashed session may have none. Multiple
 * records in one file are cumulative; callers take the last. Never carries
 * a `timestamp`.
 */
export const costStateRecordSchema = z
  .object({
    type: z.literal('cost-state'),
    /**
     * Usage per model, keyed by the raw model id as written (for example
     * `claude-opus-5[1m]`), never normalized or reduced to a fixed set of
     * keys.
     */
    modelUsage: z.record(z.string(), modelUsageSchema).optional(),
    totalCostUSD: z.number().nonnegative().optional()
  })
  .loose()

/** A validated `cost-state` transcript record. */
export type CostStateRecord = z.infer<typeof costStateRecordSchema>
