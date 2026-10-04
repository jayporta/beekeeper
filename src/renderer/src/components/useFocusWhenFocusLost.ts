import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'

/**
 * Moves focus to `target` when `trigger` changes to a non-empty value and the
 * element that had focus has since left the page, which happens when the change
 * the trigger describes unmounts the focused control. Focus anywhere else stays
 * put, and so does a page where nothing was ever focused, so a notice that shows
 * at startup doesn't pull focus past the skip link and sidebar.
 *
 * @param target - The element to focus, which needs `tabIndex={-1}`.
 * @param trigger - A value that changes when a notice appears, such as its text. An empty one never moves focus.
 * @returns Whether focus moved for the current `trigger`. A message that takes
 * focus shouldn't also be a live region, or a screen reader reads it twice, so
 * the caller drops the live role while this is `true`.
 */
export function useFocusWhenFocusLost(
  target: RefObject<HTMLElement | null>,
  trigger: string
): boolean {
  const lastFocused = useRef<EventTarget | null>(null)
  const [focusedFor, setFocusedFor] = useState('')

  useEffect(() => {
    const remember = (event: FocusEvent): void => {
      lastFocused.current = event.target
    }
    document.addEventListener('focusin', remember)
    return () => {
      document.removeEventListener('focusin', remember)
    }
  }, [])

  // The same trigger can come back later, so forget a focus once its trigger clears.
  if (trigger === '' && focusedFor !== '') setFocusedFor('')

  // A layout effect sees the DOM after the focused element unmounted, and its
  // state update re-renders before paint, so the live role never shows alongside focus.
  useLayoutEffect(() => {
    if (trigger === '') return
    const focused = document.activeElement
    if (focused !== null && focused !== document.body) return
    const last = lastFocused.current
    if (!(last instanceof Node) || last.isConnected) return
    target.current?.focus()
    setFocusedFor(trigger)
  }, [trigger, target])

  return trigger !== '' && focusedFor === trigger
}
