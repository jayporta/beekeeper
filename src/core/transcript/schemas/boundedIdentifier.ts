import { z } from 'zod'
import { isWithinCodeUnits } from '../../shared/isWithinCodeUnits'
import { hasUnprintable } from '../hasUnprintable'

/**
 * The longest identifier a transcript schema accepts, in UTF-16 code units,
 * so a character outside the Basic Multilingual Plane counts as two. Real
 * values run well under this; the cap bounds the memory a record's parsed
 * identifiers can retain in the scan cache.
 *
 * It matches the label cap in `boundedLabel.ts` by coincidence, not by
 * derivation: an identifier is matched or shown exactly as written, never
 * cleaned, while a label is cleaned before it is shown or joins a session to
 * its team, so either bound can move without the other.
 */
export const MAX_IDENTIFIER_CODE_UNITS = 256

/**
 * Whether a value is a printable string of at most
 * {@link MAX_IDENTIFIER_CODE_UNITS} UTF-16 code units, so it is safe to match
 * or show exactly as written.
 *
 * @param value - A candidate identifier, which need not be a string.
 * @returns Whether `value` is a string within the cap with no unprintable
 * character (see {@link hasUnprintable}).
 */
export function isBoundedIdentifier(value: unknown): value is string {
  return isWithinCodeUnits(value, MAX_IDENTIFIER_CODE_UNITS) && !hasUnprintable(value)
}

/**
 * A short identifier, such as an id, a name, a model, or a kind, that is
 * matched or shown exactly as written, never cleaned. It must be printable
 * and within {@link MAX_IDENTIFIER_CODE_UNITS} UTF-16 code units (counted that
 * way rather than by `.max()`, which counts code points). An identifier with
 * an unprintable character is rejected, not shown.
 */
export const boundedIdentifierSchema = z.string().refine(isBoundedIdentifier, {
  message: `must be printable and at most ${MAX_IDENTIFIER_CODE_UNITS} UTF-16 code units`
})
