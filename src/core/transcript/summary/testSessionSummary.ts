import type { SessionSummary } from './sessionSummary'

/**
 * Builds a {@link SessionSummary} of an empty lead session, for test
 * fixtures: no title, cost, activity or model, no skipped lines, and no
 * spawned or stopped teammates.
 *
 * @param overrides - Fields to set instead of the empty defaults.
 * @returns The summary.
 */
export function buildSessionSummary(overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    title: null,
    cost: null,
    activity: null,
    skippedLines: 0,
    role: { kind: 'lead' },
    teamSpawns: { spawns: [], stops: [], truncated: false },
    model: null,
    ...overrides
  }
}
