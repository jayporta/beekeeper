/**
 * Synthetic fixtures for spawn-context tests. Never derived from a real
 * `~/.claude` transcript.
 */

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

/** The timestamp `buildBranchRecord` stamps on every record. */
const BRANCH_RECORD_TIMESTAMP = '2026-01-01T00:00:00.000Z'

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
