/**
 * Narrows a value parsed out of a transcript line to a keyed record object.
 * `JSON.parse` accepts any JSON value, so a line holding `null`, an array,
 * a number, or a string parses successfully without being a record.
 *
 * @param value - A value returned by `parseRecord`.
 * @returns `true` when `value` is a non-null, non-array object.
 */
export function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
