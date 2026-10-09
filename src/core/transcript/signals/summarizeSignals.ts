import type { AgentSignals, ToolWait } from './agentSignals'
import type { SignalEvent } from './signalEvent'

/** Tools whose wait is spent on a person or on a subagent, so it says nothing about the agent being stuck. */
export const WAIT_EXCLUDED_TOOLS: ReadonlySet<string> = new Set([
  'Agent',
  'AskUserQuestion',
  'ExitPlanMode'
])

/** What {@link summarizeSignals} needs besides the events. */
export interface SummarizeSignalsOptions {
  /** Whether events were dropped at a cap, so the counts may be low. */
  readonly partial: boolean
}

/**
 * Turns one agent's signal events, in transcript order, into its counts.
 * @param events - The agent's own events, in the order its transcript holds them.
 * @param options - Whether the events were capped.
 * @returns The counts.
 */
export function summarizeSignals(
  events: readonly SignalEvent[],
  { partial }: SummarizeSignalsOptions
): AgentSignals {
  let toolErrors = 0
  let errorRun = 0
  let longestErrorStreak = 0
  let bashRun = 0
  let lastBashHash: number | null = null
  let longestBashRepeat = 0
  let compactions = 0
  let agentsKilled = 0
  let longestToolWait: ToolWait | null = null
  const calls = new Map<string, { tool: string; atMs: number | null }>()

  for (const event of events) {
    switch (event.kind) {
      case 'tool-call':
        calls.set(event.toolUseId, { tool: event.tool, atMs: event.atMs })
        if (event.tool !== 'Bash') break
        bashRun = event.commandHash !== null && event.commandHash === lastBashHash ? bashRun + 1 : 1
        lastBashHash = event.commandHash
        longestBashRepeat = Math.max(longestBashRepeat, bashRun)
        break
      case 'tool-result': {
        if (event.isError) {
          toolErrors += 1
          errorRun += 1
          longestErrorStreak = Math.max(longestErrorStreak, errorRun)
        } else {
          errorRun = 0
        }
        const matched = calls.get(event.toolUseId)
        calls.delete(event.toolUseId)
        if (matched === undefined || matched.atMs === null || event.atMs === null) break
        if (WAIT_EXCLUDED_TOOLS.has(matched.tool)) break
        const ms = event.atMs - matched.atMs
        if (
          Number.isFinite(ms) &&
          ms >= 0 &&
          (longestToolWait === null || ms > longestToolWait.ms)
        ) {
          longestToolWait = { ms, tool: matched.tool }
        }
        break
      }
      case 'compaction':
        compactions += 1
        break
      case 'agents-killed':
        agentsKilled += 1
        break
    }
  }

  return {
    toolErrors,
    longestErrorStreak,
    longestBashRepeat,
    compactions,
    agentsKilled,
    longestToolWait,
    partial
  }
}
