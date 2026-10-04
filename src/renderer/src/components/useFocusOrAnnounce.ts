import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'

/** What the hook decided for one trigger. */
interface Decision {
  /** The trigger the decision is for. */
  readonly trigger: string
  /** Whether the caller should announce the message instead of the hook focusing it. */
  readonly announce: boolean
}

const UNDECIDED: Decision = { trigger: '', announce: false }

/**
 * Tells a message apart by how a person finds out about it. When `trigger`
 * changes to a non-empty value and the element that had focus has since left the
 * page, which happens when the change the trigger describes unmounts the focused
 * control, the hook moves focus to `target` and there is nothing to announce.
 * Otherwise focus stays where it is, and the caller announces the message. A page
 * where nothing was ever focused counts as the second case, so a message that
 * shows at startup doesn't pull focus past the skip link and sidebar.
 *
 * The focus target and the live region that announces must be separate
 * elements, since a screen reader reads a live region that also takes focus twice.
 *
 * @param target - The element to focus, which needs `tabIndex={-1}`.
 * @param trigger - A value that changes when a message appears, such as its text. An empty one decides nothing.
 * @returns Whether to announce the message for the current `trigger`. It is
 * `false` for an empty trigger, until the hook has decided, and when it focused `target`.
 */
export function useFocusOrAnnounce(
  target: RefObject<HTMLElement | null>,
  trigger: string
): boolean {
  const lastFocused = useRef<EventTarget | null>(null)
  const [decision, setDecision] = useState(UNDECIDED)

  useEffect(() => {
    const remember = (event: FocusEvent): void => {
      lastFocused.current = event.target
    }
    document.addEventListener('focusin', remember)
    return () => {
      document.removeEventListener('focusin', remember)
    }
  }, [])

  // The same trigger can come back later, so forget a decision once its trigger clears.
  if (trigger === '' && decision.trigger !== '') setDecision(UNDECIDED)

  // A layout effect sees the DOM after the focused element unmounted, and its
  // state update re-renders before paint, so nothing is announced and then focused.
  useLayoutEffect(() => {
    if (trigger === '') return
    const focused = document.activeElement
    const last = lastFocused.current
    const lost =
      (focused === null || focused === document.body) && last instanceof Node && !last.isConnected
    const element = lost ? target.current : null
    element?.focus()
    setDecision({ trigger, announce: element === null })
  }, [trigger, target])

  return trigger !== '' && decision.trigger === trigger && decision.announce
}
