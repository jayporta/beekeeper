import { useEffect, useRef } from 'react'
import { useAnnouncement } from '../useAnnouncement'

/**
 * Announces a shared worktree note that arrives after its reader mounted, such
 * as when the diffs finish loading, since a person who has already read the
 * inspector would not otherwise learn it showed up. A note that was there from
 * the first render announces nothing: the selection's own announcement covers it.
 *
 * @param note - The note's text, or `null` while there is none.
 * @returns What a polite status region should show now. It empties after the hidden live copy's clear delay.
 */
export function useAnnounceSharedWorktree(note: string | null): string {
  const { message, announce } = useAnnouncement()
  const previous = useRef(note)

  useEffect(() => {
    if (previous.current === null && note !== null) announce(note)
    previous.current = note
  }, [note, announce])

  return message
}
