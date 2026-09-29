import { isLabelWithinCap } from './boundedLabel'

/**
 * Characters no real value carries and a label can't safely show: control,
 * format, surrogate and private-use code points, and any whitespace other
 * than a plain space, which covers the line and paragraph separators too.
 * A name is shown as a label and joins a session to its team, so a value
 * carrying a newline, a bidi override, U+2028, or a non-breaking space could
 * misrepresent either.
 */
const UNPRINTABLE_PATTERN = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}]|[^\S ]/u

/**
 * Cleans an untrusted short value, such as an agent type, agent name, team
 * name, model, id, or task description, into a label fit to store and show.
 * The cap is checked before anything scans the value, so an oversized one
 * costs nothing, and again after normalizing, since NFC expands a code point
 * excluded from composition rather than shortening it.
 * Trimming and normalizing matter because these values name a session's team
 * and agent: `"scout "` and `"scout"`, or a precomposed and a decomposed
 * spelling of one name, display identically, and storing both verbatim would
 * show one agent as two.
 *
 * The label can share storage with `value`, so `value` must not be a slice of
 * a string over the cap {@link isLabelWithinCap} enforces: the length check
 * can't see the parent a slice keeps alive.
 *
 * @param value - A candidate label.
 * @returns The label, a printable non-blank string within the cap, trimmed
 * and normalized to NFC, or `null` when `value` is unusable.
 */
export function toAgentLabel(value: unknown): string | null {
  if (!isLabelWithinCap(value)) return null
  if (UNPRINTABLE_PATTERN.test(value)) return null

  const trimmed = value.trim().normalize('NFC')
  if (trimmed === '' || !isLabelWithinCap(trimmed)) return null
  return trimmed
}
