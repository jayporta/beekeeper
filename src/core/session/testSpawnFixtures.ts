import { createSpawnObserver, type BranchSighting } from './spawnObserver'

/**
 * Synthetic fixtures for spawn-context tests. Never derived from a real
 * `~/.claude` transcript.
 */

/** The timestamp `buildBranchRecord` stamps on every record. */
const BRANCH_RECORD_TIMESTAMP = '2026-01-01T00:00:00.000Z'

/** The instant `stampRecord` offsets are measured from. */
export const BASE_TIME = Date.parse(BRANCH_RECORD_TIMESTAMP)

/**
 * Stamps a record with `BASE_TIME` plus an offset in ms, or with a raw string.
 *
 * @param record - The record to copy.
 * @param at - An offset in ms from `BASE_TIME`, or a raw timestamp string.
 * @returns A copy of the record carrying the timestamp.
 */
export function stampRecord(
  record: Record<string, unknown>,
  at: number | string
): Record<string, unknown> {
  return {
    ...record,
    timestamp: typeof at === 'string' ? at : new Date(BASE_TIME + at).toISOString()
  }
}

/**
 * Feeds every record to a fresh spawn observer.
 *
 * @param records - The records to observe, in order.
 * @returns The observer after seeing them all.
 */
export function observeAll(
  records: readonly Record<string, unknown>[]
): ReturnType<typeof createSpawnObserver> {
  const observer = createSpawnObserver()
  for (const record of records) observer.observe(record)
  return observer
}

interface SightingOptions {
  /** When the branch was seen, in ms; omit for an undated sighting. */
  readonly timestamp?: number | undefined
  /** The working directory; defaults to `/repo`. */
  readonly cwd?: string
}

/**
 * Builds a `BranchSighting`.
 *
 * @param branch - The branch name seen.
 * @param options - The timestamp and working directory of the sighting.
 * @returns The sighting.
 */
export function buildSighting(branch: string, options: SightingOptions = {}): BranchSighting {
  const { timestamp, cwd = '/repo' } = options
  return { branch, cwd, timestamp }
}

interface SpawnRecordOverrides {
  /** The `Agent` tool_use ids the record spawns; defaults to `['toolu_spawn']`. */
  readonly toolUseIds?: readonly string[]
  /** The record's `cwd`; an explicit `undefined` leaves it off the record. */
  readonly cwd?: unknown
  /** The record's `gitBranch`; an explicit `undefined` leaves it off the record. */
  readonly gitBranch?: unknown
  /** The tool name for every block; defaults to `Agent`. */
  readonly toolName?: string
}

/** Builds an `assistant` record whose content spawns one subagent per tool_use id. */
export function buildSpawnRecord(overrides: SpawnRecordOverrides = {}): Record<string, unknown> {
  const { toolUseIds = ['toolu_spawn'], toolName = 'Agent' } = overrides
  const cwd = 'cwd' in overrides ? overrides.cwd : '/repo'
  const gitBranch = 'gitBranch' in overrides ? overrides.gitBranch : 'main'

  return {
    type: 'assistant',
    cwd,
    gitBranch,
    message: {
      id: `msg_${toolUseIds.join('_')}`,
      model: 'claude-opus-5',
      usage: { input_tokens: 1, output_tokens: 1 },
      content: toolUseIds.map((id) => ({ type: 'tool_use', id, name: toolName, input: {} }))
    }
  }
}

/** Builds a non-spawning `user` record carrying a `cwd`, `gitBranch`, and fixed timestamp. */
export function buildBranchRecord(
  gitBranch: unknown,
  cwd: unknown = '/repo'
): Record<string, unknown> {
  return {
    type: 'user',
    cwd,
    gitBranch,
    timestamp: BRANCH_RECORD_TIMESTAMP,
    message: { role: 'user', content: 'hi' }
  }
}
