import { messageContentBlocks } from '../transcript/messageContentBlocks'
import { toolUseBlockSchema } from '../transcript/schemas'
import { recordTimestampMs } from '../transcript/summary/recordTimestampMs'
import type { SpawnContext } from './spawnContext'

/** The tool name that spawns a subagent. */
const SPAWN_TOOL_NAME = 'Agent'

/** The `gitBranch` a record carries when no branch is checked out. */
export const DETACHED_BRANCH = 'HEAD'

const MAX_CWD_CHARS = 4096
const MAX_BRANCH_CHARS = 255

/**
 * The most timeline entries a transcript may hold before it stops
 * contributing. Each new named-branch cwd adds a timeline entry, so this
 * bounds the distinct named-branch cwds too.
 */
export const MAX_TIMELINE_ENTRIES = 1024

/** Options for {@link createSpawnObserver}. */
export interface SpawnObserverOptions {
  /** The cap on timeline entries, which also bounds distinct cwds. Defaults to {@link MAX_TIMELINE_ENTRIES}. */
  readonly maxTimelineEntries?: number
}

/** A spawn's location, without the resolution-time `inferred` flag. */
export type ObservedSpawn = Omit<SpawnContext, 'inferred'>

/** Where a transcript's records showed the checkout to be, and since when. */
export interface BranchSighting {
  /** The branch name, or `HEAD` when detached. */
  readonly branch: string
  /** The absolute working directory of the record that started this run. */
  readonly cwd: string
  /**
   * Epoch milliseconds of the first record of this run with a parseable
   * timestamp, or `undefined` when no record of the run so far had one.
   */
  readonly timestamp: number | undefined
}

/** What one transcript's records showed about spawns and branches. */
export interface TranscriptSpawns {
  /** Each `Agent` `tool_use` id in the transcript, with where it was spawned. */
  readonly spawns: ReadonlyMap<string, ObservedSpawn>
  /**
   * Branch and cwd sightings in file order. An entry is appended only when
   * the branch or cwd differs from the previous entry, and carries the
   * first parseable timestamp of its run, or `undefined` for a run with none.
   * Timestamps aren't monotonic in file order, so consumers scan rather than
   * sort. A transcript that would exceed the entry cap has its timeline
   * emptied and stops recording, so it contributes no inferred sightings.
   */
  readonly timeline: readonly BranchSighting[]
  /** Epoch milliseconds of the first record with a valid timestamp, or `undefined`. */
  readonly startedAt: number | undefined
}

/** Observes one transcript's records for `Agent` spawns and its branch timeline and start. */
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
 * nearest earlier named branch of any record in the same transcript and the
 * same `cwd`, tracked per `cwd`. A `cwd` that isn't absolute and at most
 * 4096 characters, or a `gitBranch` that isn't a non-empty string of at
 * most 255, counts as absent; a spawn with no valid `cwd` is not recorded.
 *
 * Records with a valid `cwd` and a valid branch (`HEAD` included) feed the
 * timeline, each run keeping the first parseable timestamp among its records
 * (`undefined` when none has one). The first record with any parseable
 * timestamp sets the start.
 *
 * The timeline is what inference reads. Spawn bases come from the per-cwd
 * branch map instead, which any record with a named branch updates. Both are
 * capped: once the timeline passes the cap, both are emptied and stop
 * recording, so a later `HEAD` spawn gets no base. The map stays bounded
 * because each new named `cwd` adds a timeline entry.
 *
 * @param options - Optional timeline cap.
 * @returns A reducer ready to `observe` one transcript's records in order.
 */
export function createSpawnObserver(options: SpawnObserverOptions = {}): SpawnObserver {
  const { maxTimelineEntries = MAX_TIMELINE_ENTRIES } = options
  const spawns = new Map<string, ObservedSpawn>()
  const timeline: BranchSighting[] = []
  let startedAt: number | undefined
  const namedByCwd = new Map<string, string>()
  let overflowed = false
  const overflow = (): void => {
    timeline.length = 0
    namedByCwd.clear()
    overflowed = true
  }

  return {
    observe(record) {
      const cwd = validCwd(record.cwd)
      const branch = validBranch(record.gitBranch)
      const namedBranch = branch !== undefined && branch !== DETACHED_BRANCH ? branch : undefined

      if (!overflowed && cwd !== undefined && namedBranch !== undefined) {
        namedByCwd.set(cwd, namedBranch)
      }

      const previous = timeline[timeline.length - 1]
      const changed =
        !overflowed &&
        cwd !== undefined &&
        branch !== undefined &&
        (previous === undefined || previous.branch !== branch || previous.cwd !== cwd)
      const undated = previous !== undefined && previous.timestamp === undefined
      if (startedAt === undefined || changed || undated) {
        const timestamp = recordTimestampMs(record) ?? undefined
        if (timestamp !== undefined) startedAt ??= timestamp
        if (changed) {
          timeline.push({ branch, cwd, timestamp })
          if (timeline.length > maxTimelineEntries) overflow()
        } else if (
          undated &&
          timestamp !== undefined &&
          previous.branch === branch &&
          previous.cwd === cwd
        ) {
          timeline[timeline.length - 1] = { ...previous, timestamp }
        }
      }

      if (record.type !== 'assistant' || cwd === undefined) return

      const baseBranch =
        namedBranch ?? (branch === DETACHED_BRANCH ? namedByCwd.get(cwd) : undefined)

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
    result: () => ({ spawns, timeline, startedAt })
  }
}
