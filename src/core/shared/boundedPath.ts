import { isAbsolutePath } from './absolutePath'
import { isWithinCodeUnits } from './isWithinCodeUnits'

/**
 * The longest path this module accepts, in UTF-16 code units, so a character
 * outside the Basic Multilingual Plane counts as two. The cap bounds the
 * memory a path can retain once it is kept in the scan cache or a spawn
 * timeline; a real path runs far under it.
 */
export const MAX_PATH_CODE_UNITS = 4096

/**
 * True when `value` is a string within {@link MAX_PATH_CODE_UNITS}. Use
 * {@link isAbsolutePathWithinCap} instead when the path must also be absolute.
 *
 * @param value - A candidate path field.
 * @returns Whether `value` is a string within the cap.
 */
export function isPathWithinCap(value: unknown): value is string {
  return isWithinCodeUnits(value, MAX_PATH_CODE_UNITS)
}

/**
 * True when `value` is an absolute path (starts with `/`) within
 * {@link MAX_PATH_CODE_UNITS}.
 *
 * @param value - A candidate path field.
 * @returns Whether `value` is an absolute path within the cap.
 */
export function isAbsolutePathWithinCap(value: unknown): value is string {
  return isPathWithinCap(value) && isAbsolutePath(value)
}
