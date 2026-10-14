import type { StartOutcome } from '../start/startMod'
import type { PaneErrorCode } from './paneErrorCode'

/**
 * The code a view carries when the mod did not start.
 *
 * @param outcome - A start outcome that isn't ready.
 * @returns `too-old` for a Claude Code below the minimum, otherwise `start-failed`.
 */
export function startErrorCode(outcome: Exclude<StartOutcome, { kind: 'ready' }>): PaneErrorCode {
  return outcome.kind === 'too-old' ? 'too-old' : 'start-failed'
}
