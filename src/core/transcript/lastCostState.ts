import { costStateRecordSchema, type CostStateRecord } from './schemas'

/** Tracks the last valid `cost-state` record among the records it observes. */
export interface LastCostState {
  /** Feeds one parsed record, in file order. Non-cost-state and invalid records are ignored. */
  observe(record: Record<string, unknown>): void
  /** The last valid `cost-state` record observed, or `null` when there was none. */
  latest(): CostStateRecord | null
}

/**
 * Creates a reducer that keeps the last valid `cost-state` record by line
 * order. Cost-state records are cumulative snapshots, so the last one
 * supersedes the rest, and an invalid record never displaces an earlier
 * valid one.
 *
 * @returns A reducer ready to `observe` a transcript's records in order.
 */
export function createLastCostState(): LastCostState {
  let latest: CostStateRecord | null = null

  return {
    observe(record) {
      if (record.type !== 'cost-state') return
      const parsed = costStateRecordSchema.safeParse(record)
      if (parsed.success) latest = parsed.data
    },
    latest: () => latest
  }
}
