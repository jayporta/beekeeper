import { useEffect, useRef, type RefObject } from 'react'
import { useFirstRunStore } from './useFirstRunStore'

/** The elements focus can return to when the first-run screen closes. */
interface FocusTargets {
  /** The main landmark, which needs `tabIndex={-1}`. Focused after the first-launch dismissal. */
  readonly main: RefObject<HTMLElement | null>
  /** The About button. Focused after a screen that was reopened from it closes. */
  readonly about: RefObject<HTMLElement | null>
}

/**
 * Moves focus when the first-run screen closes, since the "Got it" button that
 * had focus is gone and focus would otherwise fall to the page. A screen
 * reopened from the About button returns focus to it. The first-launch
 * dismissal focuses the main landmark.
 *
 * @param targets - The elements to focus.
 */
export function useFocusOnFirstRunClose({ main, about }: FocusTargets): void {
  const isShowing = useFirstRunStore((state) => !state.dismissed || state.isOpen)
  const isReopened = useFirstRunStore((state) => state.isOpen)
  const previous = useRef({ isShowing, isReopened })

  useEffect(() => {
    if (previous.current.isShowing && !isShowing) {
      const target = previous.current.isReopened ? about : main
      target.current?.focus()
    }
    previous.current = { isShowing, isReopened }
  }, [isShowing, isReopened, main, about])
}
