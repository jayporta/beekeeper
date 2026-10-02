import { errorCode } from '../core/shared/errorCode'

/** The code a window load rejects with when it is cut short. */
const ABORTED_LOAD = 'ERR_ABORTED'

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
