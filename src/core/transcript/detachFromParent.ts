/**
 * Copies a string so it stops referencing the one it was sliced from.
 *
 * V8 represents a slice of a long string as a view onto its parent, so
 * keeping the slice alone keeps the whole parent alive. Rebuilding the string
 * from its parts allocates one that stands on its own. The cost is bounded
 * because the input is assumed to be capped already.
 *
 * @param text - An already-capped string.
 * @returns An equal string that holds no reference to a larger one.
 */
export function detachFromParent(text: string): string {
  return [...text].join('')
}
