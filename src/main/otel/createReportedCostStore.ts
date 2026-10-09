import type { ReportedCostDto } from '../../shared/ipc/reportedCostDto'
import { MAX_OTLP_RECORDS, type ReportedApiRequest } from './parseOtlpLogs'
import { requestIdKey } from './requestIdKey'

/** The most sessions held at once; the least recently reported one is dropped for a new one. */
export const MAX_STORED_SESSIONS = 500

/**
 * The most request ids remembered per session to drop a retried export; the
 * least recently reported are forgotten first. It is as many as one export can
 * carry, so a retry of any single export is recognized whole.
 */
export const MAX_REQUEST_IDS_PER_SESSION = MAX_OTLP_RECORDS

/** The most agents tracked per session. A later agent's cost still counts in the session total. */
export const MAX_AGENTS_PER_SESSION = 256

/** What the receiver has heard from Claude Code, by session, held in memory only. */
export interface ReportedCostStore {
  /**
   * Adds reported API requests to their sessions. A request whose id was
   * already seen for its session, or earlier in the same export, is skipped, so
   * a retried export counts once.
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
  /** Keys of the request ids seen, least recently reported first. */
  seenRequestIds: Set<number>
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

/**
 * Remembers request id keys as the newest, moving one already remembered to
 * the newest end, then forgets the oldest until the cap holds. A batch is
 * remembered whole before anything is forgotten, so what it forgets is never
 * one of its own.
 */
function rememberRequestIds(seen: Set<number>, keys: ReadonlySet<number>): void {
  for (const key of keys) {
    seen.delete(key)
    seen.add(key)
  }
  for (const oldest of seen) {
    if (seen.size <= MAX_REQUEST_IDS_PER_SESSION) break
    seen.delete(oldest)
  }
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
      // The request id keys of this batch by session, checked against what was seen before the batch.
      const batchKeys = new Map<SessionTotals, Set<number>>()
      for (const request of requests) {
        const totals = sessions.get(request.sessionId) ?? emptyTotals()
        sessions.delete(request.sessionId)
        sessions.set(request.sessionId, totals)
        if (request.requestId !== null) {
          const key = requestIdKey(request.requestId)
          const keys = batchKeys.get(totals) ?? new Set<number>()
          batchKeys.set(totals, keys)
          const repeated = totals.seenRequestIds.has(key) || keys.has(key)
          keys.add(key)
          if (repeated) continue
        }
        addRequest(totals, request)
      }
      for (const [totals, keys] of batchKeys) rememberRequestIds(totals.seenRequestIds, keys)
      for (const oldest of sessions.keys()) {
        if (sessions.size <= MAX_STORED_SESSIONS) break
        sessions.delete(oldest)
      }
    },
    get(sessionId) {
      const totals = sessions.get(sessionId)
      return totals === undefined ? null : snapshot(totals)
    }
  }
}
