import { useEffect, useState } from 'react'
import type { MatchCountAnnouncement } from './useMatchCountPerSearch'

/**
 * How long an announcement must hold before the region says it, in
 * milliseconds. Long enough to wait out a burst of typing, so a screen reader
 * says the count once the person pauses rather than once per keystroke, and to
 * give a region that has just mounted a head start on its text.
 */
export const ANNOUNCE_PAUSE_MS = 500

/**
 * Passes on a match count announcement once it has held for
 * {@link ANNOUNCE_PAUSE_MS}, so a newer one in the meantime replaces it
 * unsaid. Nothing to announce passes on at once.
 *
 * @param announcement - The latest announcement, or `null` for none.
 * @returns The announcement to show in the region, or `null` until there is one.
 */
export function useAnnouncementAfterPause(
  announcement: MatchCountAnnouncement | null
): MatchCountAnnouncement | null {
  const [shown, setShown] = useState<MatchCountAnnouncement | null>(null)
  if (announcement === null && shown !== null) {
    // Adjusting state while rendering: the region empties as soon as the search does.
    setShown(null)
  }

  useEffect(() => {
    if (announcement === null) return
    const timer = setTimeout(() => {
      setShown(announcement)
    }, ANNOUNCE_PAUSE_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [announcement])

  return announcement === null ? null : shown
}
