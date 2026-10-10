import { useState } from 'react'

/** A search: the folder it runs in, its text, and the list's last settled resort. */
export interface SearchTrigger {
  /** The folder whose sessions are searched. */
  readonly dirName: string
  /** The search text. */
  readonly query: string
  /** The last resort request the list settled, which changes when a Refresh or Retry press's list arrives. */
  readonly settledResortAt: number
}

/** What {@link useMatchCountPerSearch} needs to know about the search and the list. */
export interface MatchCountOptions {
  /** The search, which changes on the person's typing, folder switch, Refresh or Retry press. */
  readonly search: SearchTrigger
  /** Whether the search is active: it has text, and the folder has sessions to search. */
  readonly searching: boolean
  /** Whether the folder's list has loaded. */
  readonly loaded: boolean
}

/** A match count to announce, made in answer to one search. */
export interface MatchCountAnnouncement {
  /** How many sessions matched when the search was made. */
  readonly count: number
  /** Differs for each search, so a count equal to the last one is still announced. */
  readonly id: number
}

/** The announcement, and whether it waits for the list the search was made on. */
interface Held {
  readonly search: SearchTrigger
  readonly pending: boolean
  /** How many searches have resolved, which numbers the next announcement. */
  readonly resolved: number
  readonly announcement: MatchCountAnnouncement | null
}

const sameSearch = (a: SearchTrigger, b: SearchTrigger): boolean =>
  a.dirName === b.dirName && a.query === b.query && a.settledResortAt === b.settledResortAt

/**
 * A new search waits for its list to load, then announces the count if it is
 * active. A search that stops being active goes quiet until the next one.
 */
function nextHeld(held: Held, count: number, options: MatchCountOptions): Held {
  const { search, searching, loaded } = options
  const current = sameSearch(held.search, search) ? held : { ...held, search, pending: true }
  if (current.pending) {
    if (!loaded) return current
    const resolved = current.resolved + 1
    return {
      search,
      pending: false,
      resolved,
      announcement: searching ? { count, id: resolved } : null
    }
  }
  return !searching && current.announcement !== null ? { ...current, announcement: null } : current
}

/**
 * Holds the match count from when the search last changed, so the live region
 * that announces it speaks in answer to the person's search, folder switch,
 * Refresh or Retry press, not to a background update of the list. A search
 * that becomes active in the background, such as a leftover search in an
 * empty folder that gains a session, stays quiet.
 *
 * @param count - How many sessions match right now.
 * @param options - The search, whether it is active, and whether the list has loaded.
 * @returns The count to announce, or `null` when there is nothing to announce.
 */
export function useMatchCountPerSearch(
  count: number,
  options: MatchCountOptions
): MatchCountAnnouncement | null {
  const [held, setHeld] = useState(() =>
    nextHeld(
      { search: options.search, pending: true, resolved: 0, announcement: null },
      count,
      options
    )
  )
  const next = nextHeld(held, count, options)
  if (next !== held) {
    // Adjusting state while rendering: React re-renders at once with the held count.
    setHeld(next)
  }
  return next.announcement
}
