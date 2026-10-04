import { useEffect, type RefObject } from 'react'

/**
 * Moves focus to the main landmark around `region` when `message` turns
 * non-empty and focus has fallen to the page, which happens when the change the
 * message describes unmounts the focused control. Focus anywhere else stays put.
 *
 * @param region - An element inside the main landmark, which needs `tabIndex={-1}`.
 * @param message - The notice's text. An empty one never moves focus.
 */
export function useFocusMainWhenFocusLost(
  region: RefObject<HTMLElement | null>,
  message: string
): void {
  useEffect(() => {
    if (message === '') return
    const focused = document.activeElement
    if (focused !== null && focused !== document.body) return
    region.current?.closest('main')?.focus()
  }, [message, region])
}
