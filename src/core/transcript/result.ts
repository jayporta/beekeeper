/**
 * The outcome of an operation that can fail in an expected way, such as
 * parsing a malformed transcript line. Callers must check `ok` before
 * reading `value` or `error`.
 */
export type Result<T, E> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E }

/**
 * Wraps a successful value in a {@link Result}.
 * @param value - The value to wrap.
 * @returns A successful result holding `value`.
 */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value }
}

/**
 * Wraps an expected failure in a {@link Result}.
 * @param error - The error to wrap.
 * @returns A failed result holding `error`.
 */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error }
}
