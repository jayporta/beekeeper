import { useEffect, type RefObject } from 'react'

/**
 * Moves focus to the main landmark around `region` when `trigger` changes to a
 * non-empty value and focus has fallen to the page, which happens when the change
 * the trigger describes unmounts the focused control. Focus anywhere else stays put.
 *
 * @param region - An element inside the main landmark, which needs `tabIndex={-1}`.
 * @param trigger - A value that changes when a notice appears, such as its text. An empty one never moves focus.
 */
export function useFocusMainWhenFocusLost(
  region: RefObject<HTMLElement | null>,
  trigger: string
): void {
  useEffect(() => {
    if (trigger === '') return
    const focused = document.activeElement
    if (focused !== null && focused !== document.body) return
    region.current?.closest('main')?.focus()
  }, [trigger, region])
}
