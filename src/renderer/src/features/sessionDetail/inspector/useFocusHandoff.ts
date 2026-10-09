import { useLayoutEffect, useRef, useState } from 'react'

/** What {@link useFocusHandoff} gives the box and its target. */
interface FocusHandoff<Target extends HTMLElement> {
  /** Goes on the box element as its `ref`. */
  readonly boxRef: (box: HTMLElement | null) => void
  /** Goes on the element focus moves to. */
  readonly targetRef: React.RefObject<Target | null>
}

/**
 * Keeps keyboard focus from falling to the page when the part of a box that
 * has it is replaced. When a hand-off starts, it checks whether the focused
 * element is inside the box, in the render before the replacement removes
 * anything, and if so moves focus to the target once the replacement is in
 * place. Focus anywhere else, including on the page because the person clicked
 * plain text, is left alone.
 *
 * @param handOff - Whether the box's content has been replaced and focus should land on the target.
 * @returns The refs for the box and the target.
 */
export function useFocusHandoff<Target extends HTMLElement>(
  handOff: boolean
): FocusHandoff<Target> {
  const [box, boxRef] = useState<HTMLElement | null>(null)
  const [handedOff, setHandedOff] = useState(false)
  const [landFocus, setLandFocus] = useState(false)
  const targetRef = useRef<Target>(null)

  if (handOff !== handedOff) {
    setHandedOff(handOff)
    // Read now, before the replacement removes the element that has focus.
    setLandFocus(box !== null && box.contains(document.activeElement))
  }

  useLayoutEffect(() => {
    if (handOff && landFocus) targetRef.current?.focus()
  }, [handOff, landFocus])

  return { boxRef, targetRef }
}
