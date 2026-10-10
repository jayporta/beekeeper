import { costStateRecordSchema, type CostStateRecord, type ModelUsage } from '../schemas'
import { isBoundedIdentifier } from '../schemas/boundedIdentifier'
import { recordedTokenTotal } from './recordedTokenTotal'

/**
 * The weight, in UTF-16 code units, charged for the cost state itself and for
 * each model it keeps beyond the model's key: the record or entry object and
 * the numbers it holds.
 */
export const RECORDED_MODEL_OVERHEAD = 96

/**
 * Tracks the last valid `cost-state` record, reduced to what a usage
 * reconciliation and a session summary read.
 */
export interface RecordedCostState {
  /** Feeds one parsed record, in file order. Records that are not valid `cost-state` records are ignored. */
  observe(record: Record<string, unknown>): void
  /** The last valid `cost-state` record observed, reduced, or `null` when there was none. */
  latest(): CostStateRecord | null
  /**
   * The latest record's recorded token total across every model entry, which
   * counts entries whose keys {@link RecordedCostState.latest} leaves out, as
   * {@link recordedTokenTotal} does. `null` when there is no record, it has
   * no model usage, or the sum is not finite.
   */
  totalTokens(): number | null
  /**
   * What the tracker holds, in UTF-16 code units: {@link RECORDED_MODEL_OVERHEAD}
   * for the record and for each model it keeps, plus the length of each key.
   */
  weight(): number
}

/**
 * Reduces a `cost-state` record to what `reconcileUsage` reads: its total,
 * and for each model whose key is a bounded identifier, the four token counts
 * and the cost. Everything else is dropped, so a crafted record, which can
 * hold any number of unread fields, is not kept in a cache.
 */
function reduce(costState: CostStateRecord): CostStateRecord {
  const reduced: CostStateRecord = { type: 'cost-state' }
  if (costState.totalCostUSD !== undefined) reduced.totalCostUSD = costState.totalCostUSD
  if (costState.modelUsage === undefined) return reduced

  const entries: Array<[string, ModelUsage]> = []
  for (const [model, usage] of Object.entries(costState.modelUsage)) {
    if (!isBoundedIdentifier(model)) continue
    const kept: ModelUsage = {}
    if (usage.inputTokens !== undefined) kept.inputTokens = usage.inputTokens
    if (usage.outputTokens !== undefined) kept.outputTokens = usage.outputTokens
    if (usage.cacheReadInputTokens !== undefined) {
      kept.cacheReadInputTokens = usage.cacheReadInputTokens
    }
    if (usage.cacheCreationInputTokens !== undefined) {
      kept.cacheCreationInputTokens = usage.cacheCreationInputTokens
    }
    if (usage.costUSD !== undefined) kept.costUSD = usage.costUSD
    entries.push([model, kept])
  }
  reduced.modelUsage = Object.fromEntries(entries)
  return reduced
}

/**
 * Creates a tracker for a transcript's last valid `cost-state` record, which
 * is cumulative, so the last one supersedes the rest and an invalid one never
 * displaces a valid one. It keeps the record reduced, which gives the same
 * reconciliation as the full record while holding only what that reads.
 *
 * @returns A tracker with nothing observed.
 */
export function createRecordedCostState(): RecordedCostState {
  let latest: CostStateRecord | null = null
  let totalTokens: number | null = null
  let weight = 0

  return {
    observe(record) {
      if (record.type !== 'cost-state') return
      const parsed = costStateRecordSchema.safeParse(record)
      if (!parsed.success) return

      latest = reduce(parsed.data)
      totalTokens = recordedTokenTotal(parsed.data)
      weight = RECORDED_MODEL_OVERHEAD
      for (const model of Object.keys(latest.modelUsage ?? {})) {
        weight += RECORDED_MODEL_OVERHEAD + model.length
      }
    },
    latest: () => latest,
    totalTokens: () => totalTokens,
    weight: () => weight
  }
}
