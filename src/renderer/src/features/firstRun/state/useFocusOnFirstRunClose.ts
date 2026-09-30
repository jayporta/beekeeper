import { useEffect, useRef, type RefObject } from 'react'
import { selectIsFirstRunShowing, useFirstRunStore } from './useFirstRunStore'

/** What {@link useFocusOnFirstRunClose} needs. */
interface FocusOptions {
  /** The main landmark, which needs `tabIndex={-1}`. Focused after the first-launch dismissal. */
  readonly main: RefObject<HTMLElement | null>
  /** The About button. Focused after a screen that was reopened from it closes. */
  readonly about: RefObject<HTMLElement | null>
  /**
   * Whether the stored first-run state has been read. The store starts not
   * dismissed, so loading a stored dismissal would otherwise look like the
   * screen closing.
   */
  readonly hydrated: boolean
}

/**
 * Moves focus when the first-run screen closes, since the "Got it" button that
 * had focus is gone and focus would otherwise fall to the page. A screen
 * reopened from the About button returns focus to it. The first-launch
 * dismissal focuses the main landmark. Changes before `hydrated` are ignored.
 *
 * @param options - The elements to focus and whether the stored state is loaded.
 */
export function useFocusOnFirstRunClose({ main, about, hydrated }: FocusOptions): void {
  const isShowing = useFirstRunStore(selectIsFirstRunShowing)
  const isReopened = useFirstRunStore((state) => state.isOpen)
  const previous = useRef<{ isShowing: boolean; isReopened: boolean } | null>(null)

  useEffect(() => {
    const before = previous.current
    previous.current = hydrated ? { isShowing, isReopened } : null
    if (before?.isShowing && !isShowing) {
      const target = before.isReopened ? about : main
      target.current?.focus()
    }
  }, [hydrated, isShowing, isReopened, main, about])
}
