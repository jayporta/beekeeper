import type { SessionSummaryDto } from '../../../../shared/ipc/sessionListDto'
import type { SessionsT } from './sessionsT'

/** What {@link limitHitNote} needs besides the hit. */
interface LimitHitNoteOptions {
  /** The time to compare the reset against, in milliseconds since the Unix epoch. */
  readonly nowMs: number
  /** The sessions translate function. */
  readonly t: SessionsT
}

/**
 * Describes the plan limit a session hit, with when it resets while that is
 * still ahead.
 *
 * @param hit - The session's limit hit, or `null` when it hit none.
 * @param options - The current time and the sessions translate function.
 * @returns For example `hit 7-day limit, resets Jan 8, 2026, 10:00 AM`, or
 * `hit 7-day limit` once that time has passed, or `null` for no hit.
 */
export function limitHitNote(
  hit: SessionSummaryDto['limitHit'],
  { nowMs, t }: LimitHitNoteOptions
): string | null {
  if (hit === null) return null
  if (hit.resetsAtMs <= nowMs) {
    return hit.window === 'fiveHour' ? t('notes.limitHit.fiveHour') : t('notes.limitHit.sevenDay')
  }
  return hit.window === 'fiveHour'
    ? t('notes.limitHit.fiveHourResets', { value: hit.resetsAtMs })
    : t('notes.limitHit.sevenDayResets', { value: hit.resetsAtMs })
}
