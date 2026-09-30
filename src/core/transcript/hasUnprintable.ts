/**
 * Characters no real label carries and one can't safely show: control,
 * format, surrogate and private-use code points, and any whitespace other
 * than a plain space, which covers the line and paragraph separators too.
 * A value carrying a newline, a bidi override, U+2028, or a non-breaking
 * space could misrepresent what it shows or what it matches.
 */
const UNPRINTABLE_PATTERN = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}]|[^\S ]/u

/**
 * Whether an untrusted string holds a character that can't safely be shown.
 *
 * @param value - A string already bounded by length.
 * @returns `true` when `value` holds a control, format, surrogate or private-use
 * code point, or whitespace other than a plain space.
 */
export function hasUnprintable(value: string): boolean {
  return UNPRINTABLE_PATTERN.test(value)
}
