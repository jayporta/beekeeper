import { z } from 'zod'
import { isBoundedIdentifier } from './boundedIdentifier'
import { modelUsageSchema } from './modelUsage'

/** Drops every entry whose key is not a bounded identifier, leaving other input as it is. */
function dropUnboundedKeys(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return value
  return Object.fromEntries(Object.entries(value).filter(([key]) => isBoundedIdentifier(key)))
}

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
     * keys. An entry whose key is not a printable identifier within the
     * identifier cap (see {@link isBoundedIdentifier}) is dropped, since the
     * key reaches the UI; the record and its other entries survive.
     */
    modelUsage: z.preprocess(dropUnboundedKeys, z.record(z.string(), modelUsageSchema)).optional(),
    totalCostUSD: z.number().nonnegative().optional()
  })
  .loose()

/** A validated `cost-state` transcript record. */
export type CostStateRecord = z.infer<typeof costStateRecordSchema>
