import type { ReportedCostDto } from '../../shared/ipc/reportedCostDto'
import type { ReportedApiRequest } from './parseOtlpLogs'

/** The most sessions held at once; the least recently reported one is dropped for a new one. */
export const MAX_STORED_SESSIONS = 500

/** The most request ids remembered per session to drop a retried export; the oldest are forgotten first. */
export const MAX_REQUEST_IDS_PER_SESSION = 5000

/** The most agents tracked per session. A later agent's cost still counts in the session total. */
export const MAX_AGENTS_PER_SESSION = 256

/** What the receiver has heard from Claude Code, by session, held in memory only. */
export interface ReportedCostStore {
  /**
   * Adds reported API requests to their sessions. A request whose id was
   * already seen for its session is skipped, so a retried export counts once.
   *
   * @param requests - The requests parsed from one export.
   */
  record(requests: readonly ReportedApiRequest[]): void

  /**
   * Reads what a session has reported.
   *
   * @param sessionId - The session to look up.
   * @returns A snapshot that later reports don't change, or `null` when the
   * session never reported or has been dropped.
   */
  get(sessionId: string): ReportedCostDto | null
}

interface SessionTotals {
  costUsd: number
  requests: number
  input: number
  output: number
  cacheRead: number
  cacheCreation: number
  /** Cost by agent id, `null` for the lead. */
  byAgent: Map<string | null, number>
  seenRequestIds: Set<string>
}

function emptyTotals(): SessionTotals {
  return {
    costUsd: 0,
    requests: 0,
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheCreation: 0,
    byAgent: new Map(),
    seenRequestIds: new Set()
  }
}

/** Remembers a request id, forgetting the oldest once the cap is reached. */
function rememberRequestId(seen: Set<string>, requestId: string): void {
  if (seen.size >= MAX_REQUEST_IDS_PER_SESSION) {
    const oldest = seen.values().next()
    if (!oldest.done) seen.delete(oldest.value)
  }
  seen.add(requestId)
}

function addRequest(totals: SessionTotals, request: ReportedApiRequest): void {
  totals.costUsd += request.costUsd
  totals.requests += 1
  totals.input += request.inputTokens
  totals.output += request.outputTokens
  totals.cacheRead += request.cacheReadTokens
  totals.cacheCreation += request.cacheCreationTokens
  const agentCost = totals.byAgent.get(request.agentId)
  if (agentCost !== undefined) {
    totals.byAgent.set(request.agentId, agentCost + request.costUsd)
  } else if (totals.byAgent.size < MAX_AGENTS_PER_SESSION) {
    totals.byAgent.set(request.agentId, request.costUsd)
  }
}

function snapshot(totals: SessionTotals): ReportedCostDto {
  return {
    costUsd: totals.costUsd,
    requests: totals.requests,
    tokens: {
      input: totals.input,
      output: totals.output,
      cacheRead: totals.cacheRead,
      cacheCreation: totals.cacheCreation
    },
    byAgent: [...totals.byAgent].map(([agentId, costUsd]) => ({ agentId, costUsd }))
  }
}

/**
 * Creates the in-memory store of Claude Code's reported costs. Nothing is
 * persisted: the figures cover the time beekeeper has been listening.
 *
 * @returns An empty store holding at most {@link MAX_STORED_SESSIONS} sessions.
 */
export function createReportedCostStore(): ReportedCostStore {
  // A Map iterates in insertion order, so re-inserting a session on each report
  // keeps the first key the least recently reported.
  const sessions = new Map<string, SessionTotals>()

  return {
    record(requests) {
      for (const request of requests) {
        const existing = sessions.get(request.sessionId)
        const totals = existing ?? emptyTotals()
        if (request.requestId !== null) {
          if (totals.seenRequestIds.has(request.requestId)) continue
          rememberRequestId(totals.seenRequestIds, request.requestId)
        }
        addRequest(totals, request)
        sessions.delete(request.sessionId)
        sessions.set(request.sessionId, totals)
        if (sessions.size > MAX_STORED_SESSIONS) {
          const oldest = sessions.keys().next()
          if (!oldest.done) sessions.delete(oldest.value)
        }
      }
    },
    get(sessionId) {
      const totals = sessions.get(sessionId)
      return totals === undefined ? null : snapshot(totals)
    }
  }
}
