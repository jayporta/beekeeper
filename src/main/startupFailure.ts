import { errorCode } from '../core/shared/errorCode'

/** The code a window load rejects with when it is cut short. */
const ABORTED_LOAD = 'ERR_ABORTED'

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

/**
 * Decides whether a rejected window load should end the app. An aborted load
 * is benign only while a newer main-frame navigation is under way, as when
 * the dev server reloads the page. An abort with nothing replacing it would
 * leave the hidden window hidden, so it counts as a failure.
 *
 * @param error - The load's rejection.
 * @param mainFrameLoading - Whether the window's main frame is still loading
 * when the rejection arrives.
 * @returns `true` when the app should exit.
 */
export function isFatalLoadFailure(error: unknown, mainFrameLoading: boolean): boolean {
  return !(errorCode(error) === ABORTED_LOAD && mainFrameLoading)
}
