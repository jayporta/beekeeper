import type { AgentSignals } from '../signals/agentSignals'
import { summarizeSignals } from '../signals/summarizeSignals'
import type { LeadUsage } from './leadUsage'
import type { SessionSummary } from './sessionSummary'

/** A {@link LeadUsage} with no slots, no message ids and zero counts. */
export const EMPTY_LEAD_USAGE: LeadUsage = {
  slots: [],
  undatedMessages: 0,
  invalidAssistantRecords: 0,
  messageIds: new Set()
}

/** The {@link AgentSignals} of a transcript with no events: all zero, no wait, not partial. */
export const EMPTY_SIGNALS: AgentSignals = summarizeSignals([], { partial: false })

/**
 * Builds a {@link SessionSummary} of an empty lead session, for test
 * fixtures: no title, usage, activity, model or transcript tokens, no
 * skipped lines, no spawned or stopped teammates, an empty lead usage
 * (not `null`, which marks a transcript past the id cap), and all-zero signals.
 *
 * @param overrides - Fields to set instead of the empty defaults.
 * @returns The summary.
 */
export function buildSessionSummary(overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    title: null,
    usage: null,
    activity: null,
    skippedLines: 0,
    role: { kind: 'lead' },
    teamSpawns: { spawns: [], stops: [], truncated: false },
    model: null,
    limitHit: null,
    transcriptTokens: null,
    leadUsage: EMPTY_LEAD_USAGE,
    signals: EMPTY_SIGNALS,
    ...overrides
  }
}
