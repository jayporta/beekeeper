import { errorCode } from '../core/shared/errorCode'

/**
 * Names an error for a log line by its code, else its class, never by its
 * message, which can hold absolute paths.
 *
 * @param error - The caught value.
 * @returns The error's code, its class name, or `unknown error`.
 */
export function describeError(error: unknown): string {
  return errorCode(error) ?? (error instanceof Error ? error.name : 'unknown error')
}
