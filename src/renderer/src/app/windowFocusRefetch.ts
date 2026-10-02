import { focusManager } from '@tanstack/react-query'

/**
 * Points TanStack's focus manager at the window `focus` event and at the page
 * becoming visible. Electron keeps the document visible while another app is
 * in front, so the default `visibilitychange` listener never fires when the
 * user switches back; the window `focus` event does. Each event tells the
 * manager to re-evaluate focus, which refetches the stale queries that allow
 * it.
 *
 * Replacing the listener runs the manager's previous cleanup, so this never
 * leaves the default one registered beside it.
 *
 * @returns A cleanup that removes the listeners this registered.
 */
export function registerWindowFocusRefetch(): () => void {
  let remove = (): void => {}

  focusManager.setEventListener((handleFocus) => {
    const onFocus = (): void => {
      handleFocus()
    }
    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') handleFocus()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)
    remove = () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
    return remove
  })

  return () => {
    remove()
  }
}
