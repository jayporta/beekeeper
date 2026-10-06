import { useEffect, useRef, type RefObject } from 'react'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'

/**
 * Moves focus to the main landmark whenever the person navigates, since the
 * control they used (a project row, a breadcrumb) may stay or unmount as the
 * view swaps, and focus would otherwise stay in the sidebar or fall to the
 * page. The top of main is also brought into view: the page scrolls main, so the
 * new view would otherwise open at the old view's offset. The first render and
 * the app's own resets do not move focus or scroll.
 *
 * @param main - The main landmark, which needs `tabIndex={-1}`.
 */
export function useFocusMainOnNavigate(main: RefObject<HTMLElement | null>): void {
  const navigationCount = useNavigationStore((state) => state.navigationCount)
  const seen = useRef(navigationCount)

  useEffect(() => {
    if (seen.current === navigationCount) return
    seen.current = navigationCount
    const element = main.current
    if (!element) return
    element.focus({ preventScroll: true })
    element.scrollIntoView({ block: 'start' })
  }, [navigationCount, main])
}
