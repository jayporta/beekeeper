import { useState } from 'react'

/**
 * Holds the match count from when the search last changed, so the live region
 * that announces it speaks in answer to the person's search, not to a
 * background update of the list.
 *
 * @param count - How many sessions match right now.
 * @param search - The active search, or `null` when none is active.
 * @returns The count as it was when `search` last changed.
 */
export function useMatchCountPerSearch(count: number, search: string | null): number {
  const [held, setHeld] = useState({ search, count })
  if (held.search !== search) {
    setHeld({ search, count })
    return count
  }
  return held.count
}
