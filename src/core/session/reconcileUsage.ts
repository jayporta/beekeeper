import { normalizeModelId } from '../pricing/normalizeModelId'
import type { PriceTokensResult } from '../pricing/priceTokens'
import { compareCodeUnits } from '../transcript/compareCodeUnits'
import type { CostStateRecord, ModelUsage } from '../transcript/schemas'
import type { AgentUsage } from './agentUsage'

/** Token totals for one model on one side of a reconciliation. */
export interface ReconciledTokens {
  /** Input tokens. */
  readonly input: number
  /** Output tokens. */
  readonly output: number
  /** Tokens read from the prompt cache. */
  readonly cacheRead: number
  /** Tokens written to the prompt cache, across both retention tiers. */
  readonly cacheWrite: number
}

/** What the agents' transcripts add up to for one model. */
export interface TranscriptModelUsage extends ReconciledTokens {
  /**
   * USD of the priced groups (free groups count as 0), excluding any group
   * with no known price. `null` when no group was priced or a partial sum
   * comes to $0, so an unknown cost never reads as $0.
   */
  readonly usd: number | null
  /** Whether some group for this model had no known price, so a non-null `usd` is a lower bound. */
  readonly partial: boolean
}

/** What the lead's `cost-state` recorded for one model. */
export interface RecordedModelUsage extends ReconciledTokens {
  /**
   * The recorded cost in USD, or `null` when no entry for this model carried
   * one or a partial sum comes to $0, so an unknown cost never reads as $0.
   */
  readonly costUSD: number | null
  /** Whether some raw keys for this model carried a `costUSD` and others didn't, so it is a lower bound. */
  readonly partial: boolean
}

/** One model's usage from each side. A side with no usage for the model is `null`. */
export interface ModelReconciliation {
  /** The normalized model id both sides were grouped under. */
  readonly model: string
  /** Usage summed from the agents' transcripts. */
  readonly transcript: TranscriptModelUsage | null
  /** Usage recorded in the `cost-state`. */
  readonly recorded: RecordedModelUsage | null
}

/** A session's total cost from each side. */
export interface ReconciledTotals {
  /**
   * USD summed from every priced transcript group (free groups count as 0),
   * or `null` when none was priced or a partial total comes to $0, so an
   * unknown cost never reads as $0.
   */
  readonly transcriptUSD: number | null
  /**
   * Whether the transcript figures are a lower bound: some group had no
   * known price, or some subagent's transcript was unreadable.
   */
  readonly transcriptPartial: boolean
  /** The `cost-state`'s `totalCostUSD`, or `null` when there is no cost-state or it has no total. */
  readonly recordedUSD: number | null
}

/**
 * A session's transcript-derived usage set beside its recorded `cost-state`,
 * for display. It makes no judgement about whether the two agree.
 */
export interface UsageReconciliation {
  /** One row per normalized model on either side, sorted by model id. */
  readonly models: readonly ModelReconciliation[]
  /** The session's total cost from each side. */
  readonly totals: ReconciledTotals
}

/** Input for {@link reconcileUsage}. */
export interface ReconcileUsageInput {
  /** Usage of the lead and every readable subagent. */
  readonly agents: readonly AgentUsage[]
  /** How many subagent transcripts were unreadable and so are missing from `agents`. */
  readonly unreadableAgents: number
  /** The lead's last valid `cost-state`, or `null` when it wrote none. */
  readonly costState: CostStateRecord | null
}

/**
 * Sets what a session's transcripts add up to beside what its `cost-state`
 * recorded, per model and in total.
 *
 * Both sides group by {@link normalizeModelId}, so `claude-opus-5[1m]` and
 * `claude-opus-5` share a row, and the transcript side also sums across
 * billing speeds and agents. A model present on only one side still gets a
 * row, with the other side `null`. Totals are `partial` when a group is
 * unpriced or a subagent transcript was unreadable. `thinkingTokens` and
 * `webSearchRequests` are not token classes and are ignored.
 *
 * @param input - The agents' usage and the lead's cost-state.
 * @returns The per-model rows and session totals.
 */
export function reconcileUsage(input: ReconcileUsageInput): UsageReconciliation {
  const transcript = sumTranscript(input.agents)
  const recorded = sumRecorded(input.costState)

  const models = [...new Set([...transcript.keys(), ...recorded.keys()])]
    .sort(compareCodeUnits)
    .map((model) => ({
      model,
      transcript: withKnownUsd(transcript.get(model)),
      recorded: withKnownCost(recorded.get(model))
    }))

  let transcriptUSD: number | null = null
  let transcriptPartial = input.unreadableAgents > 0
  for (const usage of transcript.values()) {
    if (usage.usd !== null) transcriptUSD = (transcriptUSD ?? 0) + usage.usd
    transcriptPartial ||= usage.partial
  }

  return {
    models,
    totals: {
      transcriptUSD: knownUsd(transcriptUSD, transcriptPartial),
      transcriptPartial,
      recordedUSD: input.costState?.totalCostUSD ?? null
    }
  }
}

/** Returns `null` for a partial $0, so an unknown cost never reads as $0. */
function knownUsd(usd: number | null, partial: boolean): number | null {
  return partial && usd === 0 ? null : usd
}

function withKnownUsd(usage: TranscriptModelUsage | undefined): TranscriptModelUsage | null {
  return usage ? { ...usage, usd: knownUsd(usage.usd, usage.partial) } : null
}

function withKnownCost(usage: RecordedModelUsage | undefined): RecordedModelUsage | null {
  return usage ? { ...usage, costUSD: knownUsd(usage.costUSD, usage.partial) } : null
}

function sumTranscript(agents: readonly AgentUsage[]): Map<string, TranscriptModelUsage> {
  const byModel = new Map<string, TranscriptModelUsage>()

  for (const agent of agents) {
    for (const group of agent.tokenGroups) {
      const model = normalizeModelId(group.model)
      const previous = byModel.get(model)
      byModel.set(model, {
        input: (previous?.input ?? 0) + group.tokens.input,
        output: (previous?.output ?? 0) + group.tokens.output,
        cacheRead: (previous?.cacheRead ?? 0) + group.tokens.cacheRead,
        cacheWrite:
          (previous?.cacheWrite ?? 0) + group.tokens.cacheWrite5m + group.tokens.cacheWrite1h,
        usd: addPricedUsd(previous?.usd ?? null, group.price),
        partial: (previous?.partial ?? false) || group.price.kind === 'unpriced'
      })
    }
  }

  return byModel
}

function sumRecorded(costState: CostStateRecord | null): Map<string, RecordedModelUsage> {
  const byModel = new Map<string, RecordedModelUsage>()

  for (const [rawModel, usage] of Object.entries(costState?.modelUsage ?? {})) {
    const model = normalizeModelId(rawModel)
    const previous = byModel.get(model)
    byModel.set(model, addRecorded(previous, usage))
  }

  return byModel
}

function addRecorded(
  previous: RecordedModelUsage | undefined,
  usage: ModelUsage
): RecordedModelUsage {
  const costUSD =
    usage.costUSD === undefined
      ? (previous?.costUSD ?? null)
      : (previous?.costUSD ?? 0) + usage.costUSD

  const mixed =
    previous !== undefined && (previous.costUSD === null) !== (usage.costUSD === undefined)

  return {
    input: (previous?.input ?? 0) + (usage.inputTokens ?? 0),
    output: (previous?.output ?? 0) + (usage.outputTokens ?? 0),
    cacheRead: (previous?.cacheRead ?? 0) + (usage.cacheReadInputTokens ?? 0),
    cacheWrite: (previous?.cacheWrite ?? 0) + (usage.cacheCreationInputTokens ?? 0),
    costUSD,
    partial: (previous?.partial ?? false) || mixed
  }
}

/** Adds a group's price to a running USD, leaving it unchanged for an unpriced group. */
function addPricedUsd(running: number | null, price: PriceTokensResult): number | null {
  if (price.kind === 'unpriced') return running
  return (running ?? 0) + (price.kind === 'priced' ? price.usd : 0)
}
