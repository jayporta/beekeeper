import { useEffect, useRef } from 'react'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { useSelectedProjectStore } from './useSelectedProjectStore'

/**
 * Drops the recorded missing folder when the person navigates, so its notice
 * does not outlive the view it was about. The app's own `reset` does not count
 * as navigation, so the fallback that follows a missing folder keeps the notice.
 */
export function useClearGoneFolderOnNavigation(): void {
  const navigationCount = useNavigationStore((state) => state.navigationCount)
  const clearGoneFolder = useSelectedProjectStore((state) => state.clearGoneFolder)
  const seenCount = useRef(navigationCount)

  useEffect(() => {
    if (seenCount.current === navigationCount) return
    seenCount.current = navigationCount
    clearGoneFolder()
  }, [navigationCount, clearGoneFolder])
}
