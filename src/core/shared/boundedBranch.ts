import { isWithinCodeUnits } from './isWithinCodeUnits'

/**
 * The longest branch name this module accepts, in UTF-16 code units, so a
 * character outside the Basic Multilingual Plane counts as two. Beekeeper's
 * own bound on an untrusted value, not git's.
 */
export const MAX_BRANCH_CODE_UNITS = 255

/**
 * True when `value` is a non-empty branch name within
 * {@link MAX_BRANCH_CODE_UNITS}.
 *
 * @param value - A candidate branch name.
 * @returns Whether `value` is a non-empty string within the cap.
 */
export function isBranchNameWithinCap(value: unknown): value is string {
  return isWithinCodeUnits(value, MAX_BRANCH_CODE_UNITS) && value.length > 0
}
