import { DETACHED_BRANCH, type BranchSighting } from './spawnObserver'

/** Where a subagent's checkout was, as read from one ancestor's timeline. */
export interface PickedLocation {
  /** The working directory of the picked sighting. */
  readonly cwd: string
  /** The named branch, or `undefined` when only a detached `HEAD` could be found. */
  readonly baseBranch: string | undefined
}

function lastIndexAtOrBefore(timeline: readonly BranchSighting[], at: number | undefined): number {
  if (at === undefined) return timeline.length - 1
  for (let i = timeline.length - 1; i >= 0; i--) {
    const entry = timeline[i]
    if (entry !== undefined && entry.timestamp <= at) return i
  }
  return -1
}

/**
 * Picks where a subagent started from one transcript's timeline: the last
 * entry in file order whose timestamp is at or before `at`. File order is
 * scanned, not sorted, because timestamps step backwards between records. A
 * `HEAD` pick borrows the nearest earlier named branch in the same cwd, and
 * has no base when there is none.
 *
 * @param timeline - A transcript's sightings in file order.
 * @param at - The subagent's start in epoch milliseconds. When `undefined`,
 * the latest entry is picked.
 * @returns The location, or `undefined` when no entry qualifies.
 */
export function pickSighting(
  timeline: readonly BranchSighting[],
  at: number | undefined
): PickedLocation | undefined {
  const index = lastIndexAtOrBefore(timeline, at)
  const picked = timeline[index]
  if (picked === undefined) return undefined
  if (picked.branch !== DETACHED_BRANCH) return { cwd: picked.cwd, baseBranch: picked.branch }
  for (let i = index - 1; i >= 0; i--) {
    const earlier = timeline[i]
    if (earlier !== undefined && earlier.branch !== DETACHED_BRANCH && earlier.cwd === picked.cwd) {
      return { cwd: picked.cwd, baseBranch: earlier.branch }
    }
  }
  return { cwd: picked.cwd, baseBranch: undefined }
}
