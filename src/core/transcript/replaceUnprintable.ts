import { UNPRINTABLE_PATTERN } from './hasUnprintable'

/** The shared pattern with the global flag, so every occurrence is replaced. */
const UNPRINTABLE_EVERYWHERE = new RegExp(UNPRINTABLE_PATTERN.source, 'gu')

/**
 * Turns every character {@link hasUnprintable} flags into a plain space, so an
 * untrusted string is safe to show on one line.
 *
 * @remarks
 * A ZWJ emoji sequence comes out split by spaces, since the joiner is a format character.
 *
 * @param value - An untrusted string.
 * @returns `value` with each control, format, lone-surrogate and private-use code point, and each whitespace other than a plain space, replaced by a space.
 */
export function replaceUnprintable(value: string): string {
  return value.replace(UNPRINTABLE_EVERYWHERE, ' ')
}
