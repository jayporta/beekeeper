import { isWithinCodeUnits } from '../shared/isWithinCodeUnits'

/**
 * The longest agent label kept, in UTF-16 code units, so a character outside
 * the Basic Multilingual Plane counts as two. Real names run under about 30
 * code units and task descriptions under about 70; the cap exists because a
 * transcript is untrusted input and a summary sits in a cache for as long as
 * the app runs.
 *
 * It matches the identifier cap in `schemas/boundedIdentifier.ts` by
 * coincidence, not by derivation: a label is cleaned before it is shown or
 * joins a session to its team, while an identifier is matched or shown
 * exactly as written, so either bound can move without the other.
 */
export const MAX_LABEL_CODE_UNITS = 256

/**
 * True when `value` is a string within {@link MAX_LABEL_CODE_UNITS}.
 *
 * @param value - A candidate agent type, agent name, team name, or other label field.
 * @returns Whether `value` is a string within the cap.
 */
export function isLabelWithinCap(value: unknown): value is string {
  return isWithinCodeUnits(value, MAX_LABEL_CODE_UNITS)
}
