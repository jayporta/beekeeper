/**
 * Copies a short string so it stops referencing the one it was sliced from.
 *
 * V8 represents a slice of a long string as a view onto its parent, so
 * returning the slice alone would keep the whole untrusted value alive for
 * as long as a summary is cached, which is what the caps exist to prevent.
 * `trim().normalize('NFC')` does not help: it returns its receiver unchanged
 * for a string already in NFC. Rebuilding the string from its parts
 * allocates one that stands on its own. This is deliberate rather than
 * redundant: dropping it restores the alias. The cost is bounded because the
 * input is already capped.
 *
 * @param text - An already-capped string.
 * @returns An equal string that holds no reference to a larger one.
 */
export function detachFromParent(text: string): string {
  return [...text].join('')
}
