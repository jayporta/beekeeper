import { useState } from 'react'

/** An active search: the folder it runs in, its text, and the list's last settled resort. */
export interface ActiveSearch {
  /** The folder whose sessions are searched. */
  readonly dirName: string
  /** The search text. */
  readonly query: string
  /** The last resort request the list settled, which changes when a Refresh press's list arrives. */
  readonly settledResortAt: number
}

const sameSearch = (a: ActiveSearch | null, b: ActiveSearch | null): boolean =>
  a === b ||
  (a !== null &&
    b !== null &&
    a.dirName === b.dirName &&
    a.query === b.query &&
    a.settledResortAt === b.settledResortAt)

/**
 * Holds the match count from when the search last changed, so the live region
 * that announces it speaks in answer to the person's search, folder switch or
 * Refresh press, not to a background update of the list.
 *
 * @param count - How many sessions match right now.
 * @param search - The active search, or `null` when none is active.
 * @returns The count as it was when `search` last changed.
 */
export function useMatchCountPerSearch(count: number, search: ActiveSearch | null): number {
  const [held, setHeld] = useState({ search, count })
  if (!sameSearch(held.search, search)) {
    setHeld({ search, count })
    return count
  }
  return held.count
}
