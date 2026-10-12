import { createLruMap } from '../../core/shared/lruMap'
import { captureSystemError } from '../../core/transcript/captureSystemError'
import { readWorkflowRun } from '../../core/transcript/readWorkflowRun'
import type { WorkflowRunId } from '../../core/transcript/workflowRunId'

/** The most distinct workflow run names one {@link WorkflowRunNamesCache.read} returns. */
export const MAX_WORKFLOW_RUN_NAMES = 64

/**
 * The default bound on the cache's total weight, in UTF-16 code units. An
 * entry weighs a few hundred, and the strings a full cache holds take at most
 * 2 MB, at two bytes per code unit.
 */
export const WORKFLOW_RUN_NAMES_CACHE_MAX_WEIGHT = 1_000_000

/** The weight charged for each entry beyond its strings: the entry object. */
const ENTRY_OVERHEAD = 128

/** Which runs of which session to read the names of. */
export interface WorkflowRunNamesRequest {
  /** The session's directory. */
  readonly sessionDir: string
  /** The runs to read, in the order their names should come back. */
  readonly runIds: readonly WorkflowRunId[]
}

/** Keeps the name of each workflow run, so listing rereads only records that may have changed. */
export interface WorkflowRunNamesCache {
  /**
   * Returns the names of a session's workflow runs, reading a run's record
   * only when nothing is cached for it.
   *
   * @param request - The session and its runs.
   * @returns Each distinct name once, in the order the runs were given, up to
   * {@link MAX_WORKFLOW_RUN_NAMES}. A run with no usable name, or whose
   * record can't be read, has none.
   */
  read(request: WorkflowRunNamesRequest): Promise<readonly string[]>
}

/** Options for {@link createWorkflowRunNamesCache}. */
export interface WorkflowRunNamesCacheOptions {
  /**
   * The most total weight, in UTF-16 code units, the cache keeps.
   * @defaultValue {@link WORKFLOW_RUN_NAMES_CACHE_MAX_WEIGHT}
   */
  readonly maxWeight?: number
  /** Reads one run's record. Defaults to `readWorkflowRun`; injectable for tests. */
  readonly readRun?: typeof readWorkflowRun
}

/** What is kept for one run: its key, for weighing, and its name. */
interface CachedName {
  readonly key: string
  readonly name: string | null
}

function weigh({ key, name }: CachedName): number {
  return ENTRY_OVERHEAD + key.length + (name?.length ?? 0)
}

/**
 * Creates a name cache with one entry per run, keyed by session directory and
 * run id. Entries are evicted least recently used first once their total
 * weight passes the bound, and an entry heavier than the whole bound is served
 * but not kept.
 *
 * A name is kept once the record is read. A record with no name is kept only
 * when the run is completed, since a run still writing its record may gain
 * one. A record that is missing, unusable, or can't be read for a system
 * reason (such as a permissions error) is not kept, so the next read looks
 * again and a record written later is found. Records are read one at a time,
 * and a record's name is assumed not to change once the record is read.
 *
 * @param options - The weight bound and the record reader.
 * @returns An empty cache.
 */
export function createWorkflowRunNamesCache(
  options: WorkflowRunNamesCacheOptions = {}
): WorkflowRunNamesCache {
  const { maxWeight = WORKFLOW_RUN_NAMES_CACHE_MAX_WEIGHT, readRun = readWorkflowRun } = options
  const entries = createLruMap<string, CachedName>({ maxWeight, weigh })

  async function nameOf(sessionDir: string, runId: WorkflowRunId): Promise<string | null> {
    const key = `${sessionDir}\0${runId}`
    const hit = entries.get(key)
    if (hit !== undefined) return hit.name

    const read = await captureSystemError(() => readRun(sessionDir, runId))
    if (!read.ok || !read.value.ok) return null

    const { name, completed } = read.value.value
    if (name !== null || completed) entries.set(key, { key, name })
    return name
  }

  return {
    async read({ sessionDir, runIds }) {
      const names = new Set<string>()
      for (const runId of runIds) {
        if (names.size === MAX_WORKFLOW_RUN_NAMES) break
        const name = await nameOf(sessionDir, runId)
        if (name !== null) names.add(name)
      }
      return [...names]
    }
  }
}
