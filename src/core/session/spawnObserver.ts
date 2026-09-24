import { messageContentBlocks } from '../transcript/messageContentBlocks'
import { toolUseBlockSchema } from '../transcript/schemas'
import type { SpawnContext } from './spawnContext'

/** The tool name that spawns a subagent. */
const SPAWN_TOOL_NAME = 'Agent'

/** The `gitBranch` a record carries when no branch is checked out. */
const DETACHED_BRANCH = 'HEAD'

const MAX_CWD_CHARS = 4096
const MAX_BRANCH_CHARS = 255

/** A spawn's location, without the resolution-time `inferred` flag. */
export type ObservedSpawn = Omit<SpawnContext, 'inferred'>

/** A named branch and the working directory of the record it was seen on. */
export interface BranchSighting {
  /** The branch name. Never `HEAD`. */
  readonly branch: string
  /** The absolute working directory of the record that named the branch. */
  readonly cwd: string
}

/** What one transcript's records showed about spawns and branches. */
export interface TranscriptSpawns {
  /** Each `Agent` `tool_use` id in the transcript, with where it was spawned. */
  readonly spawns: ReadonlyMap<string, ObservedSpawn>
  /** The last record naming a non-`HEAD` branch with a valid cwd, or `undefined`. */
  readonly lastBranch: BranchSighting | undefined
}

/** Observes one transcript's records for `Agent` spawns and its last named branch. */
export interface SpawnObserver {
  /** Feeds one parsed record, in file order. */
  observe(record: Record<string, unknown>): void
  /** What the records observed so far showed. */
  result(): TranscriptSpawns
}

function validCwd(value: unknown): string | undefined {
  return typeof value === 'string' && value.startsWith('/') && value.length <= MAX_CWD_CHARS
    ? value
    : undefined
}

function validBranch(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_BRANCH_CHARS
    ? value
    : undefined
}

/**
 * Creates a reducer over one transcript's records. Each `Agent` `tool_use`
 * block records the `cwd` and `gitBranch` of its record; a repeated id keeps
 * its first entry. A `HEAD` branch means no base, so the spawn takes the
 * last named branch seen earlier in the same transcript, but only when that
 * sighting was in the same `cwd`. A `cwd` that isn't absolute and at most
 * 4096 characters, or a `gitBranch` that isn't a non-empty string of at
 * most 255, counts as absent; a spawn with no valid `cwd` is not recorded.
 *
 * @returns A reducer ready to `observe` one transcript's records in order.
 */
export function createSpawnObserver(): SpawnObserver {
  const spawns = new Map<string, ObservedSpawn>()
  let lastBranch: BranchSighting | undefined

  return {
    observe(record) {
      const cwd = validCwd(record.cwd)
      const branch = validBranch(record.gitBranch)
      const namedBranch = branch !== undefined && branch !== DETACHED_BRANCH ? branch : undefined

      if (cwd !== undefined && namedBranch !== undefined) lastBranch = { branch: namedBranch, cwd }
      if (record.type !== 'assistant' || cwd === undefined) return

      const baseBranch =
        namedBranch ??
        (branch === DETACHED_BRANCH && lastBranch?.cwd === cwd ? lastBranch.branch : undefined)

      for (const block of messageContentBlocks(record)) {
        if (typeof block !== 'object' || block === null) continue
        if (!('type' in block) || block.type !== 'tool_use') continue
        if (!('name' in block) || block.name !== SPAWN_TOOL_NAME) continue
        const parsed = toolUseBlockSchema.safeParse(block)
        if (parsed.success && !spawns.has(parsed.data.id)) {
          spawns.set(parsed.data.id, { cwd, baseBranch })
        }
      }
    },
    result: () => ({ spawns, lastBranch })
  }
}
