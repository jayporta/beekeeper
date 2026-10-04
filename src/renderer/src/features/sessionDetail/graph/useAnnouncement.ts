import { useCallback, useRef, useState } from 'react'
import { useFocusOrAnnounce } from '@renderer/components/useFocusOrAnnounce'

/** The announcement source of a status region. */
interface Announcement {
  /** What to say now. It is empty until something is announced, and again after the hidden live copy's clear delay. Transcript-derived: render as plain text. */
  readonly message: string
  /** Replaces what is said with a new message. The newest message wins, however soon after another it comes. */
  readonly announce: (message: string) => void
}

/** The latest message, and how many have been announced, which tells one from the next. */
interface Spoken {
  readonly count: number
  readonly message: string
}

/**
 * The one source a polite status region announces from. Several things can
 * have news for the same region, and the region can only say the latest of
 * them, so they share this source instead of each holding its own text.
 *
 * @returns The message to show in the region, and the function that announces a new one.
 */
export function useAnnouncement(): Announcement {
  const [spoken, setSpoken] = useState<Spoken>({ count: 0, message: '' })
  const announce = useCallback((message: string) => {
    setSpoken((previous) => ({ count: previous.count + 1, message }))
  }, [])

  // The ref never holds an element, so the hook never moves focus and always announces.
  const noFocusTarget = useRef<HTMLElement>(null)
  const speaking = useFocusOrAnnounce(
    noFocusTarget,
    spoken.count === 0 ? '' : `announcement:${spoken.count}`
  )
  return { message: speaking ? spoken.message : '', announce }
}
