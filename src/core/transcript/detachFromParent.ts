/**
 * Copies a string so it holds no reference to the larger one it was sliced
 * from. V8 can keep a slice as a view onto its parent, so keeping the slice
 * alone would keep the whole parent alive.
 *
 * @param text - An already-capped string.
 * @returns An equal string that shares no storage with the input.
 */
export function detachFromParent(text: string): string {
  return [...text].join('')
}
