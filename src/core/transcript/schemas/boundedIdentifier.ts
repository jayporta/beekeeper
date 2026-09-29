import { z } from 'zod'
import { isWithinCodeUnits } from '../../shared/isWithinCodeUnits'

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
 * A short identifier, such as an id, a name, a model, or a kind, that is
 * matched or shown exactly as written, never cleaned. Bounded to
 * {@link MAX_IDENTIFIER_CODE_UNITS} UTF-16 code units, rather than by
 * `.max()`, which counts code points.
 */
export const boundedIdentifierSchema = z
  .string()
  .refine((value) => isWithinCodeUnits(value, MAX_IDENTIFIER_CODE_UNITS), {
    message: `must be at most ${MAX_IDENTIFIER_CODE_UNITS} UTF-16 code units`
  })
