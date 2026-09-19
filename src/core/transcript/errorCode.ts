/**
 * Extracts a caught error's `code` property, if it has one.
 * @param error - The value caught from a failed operation.
 * @returns The error's `code`, or `undefined` when it has none or isn't a string.
 */
export function errorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined
  const { code } = error
  return typeof code === 'string' ? code : undefined
}
