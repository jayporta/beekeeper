/**
 * The longest title the summary keeps, in UTF-16 code units, so a character
 * outside the Basic Multilingual Plane counts as two. Real titles are a
 * short phrase; the cap exists because a transcript is untrusted input and a
 * summary is held in a cache for as long as the app runs.
 */
const MAX_TITLE_CODE_UNITS = 200

/** The range of UTF-16 code units that open a surrogate pair. */
const HIGH_SURROGATE_FIRST = 0xd800
const HIGH_SURROGATE_LAST = 0xdbff

/**
 * Caps a title read out of a transcript at a length worth displaying.
 *
 * Takes a bounded prefix by code unit rather than walking the whole string,
 * so an oversized title costs no more than the prefix; a title's length is
 * only bounded by the reader's line cap, and turning one into an array of
 * code points would cost gigabytes. Cutting by code unit can land inside a
 * surrogate pair, so a trailing unpaired high surrogate is dropped and the
 * cut never splits a pair in half. A title that already held an unpaired
 * surrogate keeps it: the cut repairs only the damage it would itself do.
 *
 * @param title - A title as it appeared in the transcript.
 * @returns The title, shortened to at most {@link MAX_TITLE_CODE_UNITS} code
 * units when it was longer, and never sharing storage with it.
 */
export function truncateTitle(title: string): string {
  if (title.length <= MAX_TITLE_CODE_UNITS) return title

  const prefix = title.slice(0, MAX_TITLE_CODE_UNITS)
  const lastUnit = prefix.charCodeAt(prefix.length - 1)
  const endsMidPair = lastUnit >= HIGH_SURROGATE_FIRST && lastUnit <= HIGH_SURROGATE_LAST

  return detachFromParent(endsMidPair ? prefix.slice(0, -1) : prefix)
}

/**
 * Copies a short string so it stops referencing the one it was sliced from.
 *
 * V8 represents a slice of a long string as a view onto its parent, so
 * returning the slice alone would keep the whole untrusted title alive for
 * as long as the summary is cached, which is what the cap exists to
 * prevent. Rebuilding the string from its parts allocates one that stands
 * on its own. This is deliberate rather than redundant: dropping it
 * restores the alias, and the cost is bounded because the input is already
 * capped.
 *
 * @param text - An already-capped string.
 * @returns An equal string that holds no reference to a larger one.
 */
function detachFromParent(text: string): string {
  return [...text].join('')
}
