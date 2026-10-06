import { useEffect, useRef, type RefObject } from 'react'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'

/**
 * Moves focus to the main landmark whenever the person navigates, since the
 * control they used (a project row, a breadcrumb) may stay or unmount as the
 * view swaps, and focus would otherwise stay in the sidebar or fall to the
 * page. Main also returns to the top of the new view: it scrolls on its own, so
 * the view would otherwise open at the old view's offset, and its top is brought
 * into view where the page scrolls as a whole. The first render and the app's own
 * resets do not move focus or scroll.
 *
 * @param main - The main landmark, which needs `tabIndex={-1}`.
 */
export function useFocusMainOnNavigate(main: RefObject<HTMLElement | null>): void {
  const navigationCount = useNavigationStore((state) => state.navigationCount)
  const seen = useRef(navigationCount)

  useEffect(() => {
    if (seen.current === navigationCount) return
    seen.current = navigationCount
    if (main.current) showTopOfMain(main.current)
  }, [navigationCount, main])
}

function showTopOfMain(element: HTMLElement): void {
  element.scrollTop = 0
  element.focus({ preventScroll: true })
  element.scrollIntoView({ block: 'start' })
}
