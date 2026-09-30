import { useEffect, useRef } from 'react'
import { FirstRunScreen } from '@renderer/features/firstRun/FirstRunScreen'
import { useFirstRunStore } from '@renderer/features/firstRun/state/useFirstRunStore'

/**
 * The main area's current view: the first-run screen until it is dismissed
 * (or while it is reopened from About), otherwise the sessions view. When the
 * first-run screen closes, focus moves to the main heading so it isn't lost
 * with the button that was pressed.
 *
 * @example
 * <main><MainView /></main>
 */
export function MainView(): React.JSX.Element {
  const showFirstRun = useFirstRunStore((state) => !state.dismissed || state.isOpen)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const wasShowingFirstRun = useRef(showFirstRun)

  useEffect(() => {
    if (wasShowingFirstRun.current && !showFirstRun) headingRef.current?.focus()
    wasShowingFirstRun.current = showFirstRun
  }, [showFirstRun])

  if (showFirstRun) return <FirstRunScreen />
  return (
    <h1 ref={headingRef} tabIndex={-1}>
      Sessions
    </h1>
  )
}
