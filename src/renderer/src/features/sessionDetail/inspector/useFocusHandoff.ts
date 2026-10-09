import { useEffect, useLayoutEffect, useRef, useState } from 'react'

/** What {@link useFocusHandoff} gives the box and its target. */
interface FocusHandoff<Target extends HTMLElement> {
  /** Whether focus is, or last was, inside the box. */
  readonly focusInside: boolean
  /** Goes on the box element as its `ref`. */
  readonly boxRef: (box: HTMLElement | null) => void
  /** Goes on the element focus moves to. */
  readonly targetRef: React.RefObject<Target | null>
}

/**
 * Keeps keyboard focus from falling to the page when the part of a box that
 * has it is replaced. It watches the box for focus entering and leaving it.
 * When a hand-off starts while focus was inside the box, focus moves to the
 * target. A hand-off while focus is anywhere else, or nowhere, changes
 * nothing.
 *
 * A blur that names no element is ignored, since it is also what removing the
 * focused element looks like, so the flag still says focus was inside. A blur
 * that names the element focus moved to clears the flag if that is outside.
 *
 * @param handOff - Whether the box's content has been replaced and focus should land on the target.
 * @returns The flag, and the refs for the box and the target.
 */
export function useFocusHandoff<Target extends HTMLElement>(
  handOff: boolean
): FocusHandoff<Target> {
  const [box, boxRef] = useState<HTMLElement | null>(null)
  const [focusInside, setFocusInside] = useState(false)
  const targetRef = useRef<Target>(null)

  useEffect(() => {
    if (box === null) return
    const onFocusIn = (): void => {
      setFocusInside(true)
    }
    const onFocusOut = (event: FocusEvent): void => {
      const next = event.relatedTarget
      if (next !== null) setFocusInside(next instanceof Node && box.contains(next))
    }
    box.addEventListener('focusin', onFocusIn)
    box.addEventListener('focusout', onFocusOut)
    return () => {
      box.removeEventListener('focusin', onFocusIn)
      box.removeEventListener('focusout', onFocusOut)
    }
  }, [box])

  useLayoutEffect(() => {
    if (handOff && focusInside) targetRef.current?.focus()
  }, [handOff, focusInside])

  return { focusInside, boxRef, targetRef }
}
