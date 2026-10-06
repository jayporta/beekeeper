import { useEffect, useRef, type RefObject } from 'react'
import { selectIsFirstRunShowing, useFirstRunStore } from './useFirstRunStore'

/** What {@link useFocusOnFirstRunClose} needs. */
interface FocusOptions {
  /** The main landmark, which needs `tabIndex={-1}`. Focused when the screen closes. */
  readonly main: RefObject<HTMLElement | null>
  /**
   * Whether the stored first-run state has been read. The store starts not
   * dismissed, so loading a stored dismissal would otherwise look like the
   * screen closing.
   */
  readonly hydrated: boolean
}

/**
 * Moves focus to the main landmark when the first-run screen closes, since the
 * control that had focus is gone and focus would otherwise fall to the page.
 * Changes before `hydrated` are ignored.
 *
 * @param options - The element to focus and whether the stored state is loaded.
 */
export function useFocusOnFirstRunClose({ main, hydrated }: FocusOptions): void {
  const isShowing = useFirstRunStore(selectIsFirstRunShowing)
  const wasShowing = useRef<boolean | null>(null)

  useEffect(() => {
    const before = wasShowing.current
    wasShowing.current = hydrated ? isShowing : null
    if (before === true && !isShowing) main.current?.focus()
  }, [hydrated, isShowing, main])
}
