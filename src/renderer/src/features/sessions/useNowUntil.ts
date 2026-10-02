import { useEffect, useState } from 'react'

/** The longest wait before the hook re-reads the clock, in milliseconds. */
export const RECHECK_INTERVAL_MS = 60_000

/**
 * Reads the current time, and moves it forward once a deadline has passed so
 * what depends on the deadline can update while the view stays open.
 *
 * @param deadlineMs - The time to wake at, in milliseconds since the Unix epoch,
 * or `null` for none. No timer is set for a deadline that has already passed.
 * @returns The time the hook last read the clock: on mount, then on each
 * re-check until the deadline has passed.
 * @remarks Timers don't advance while the machine sleeps, so one long wait would
 * fire late. The hook re-checks the clock at most once a minute until the
 * deadline has passed, so a reset is noticed within a minute even after sleep.
 * @example
 * const nowMs = useNowUntil(hit === null ? null : hit.resetsAtMs)
 */
export function useNowUntil(deadlineMs: number | null): number {
  const [nowMs, setNowMs] = useState(Date.now)

  useEffect(() => {
    if (deadlineMs === null || nowMs >= deadlineMs) return
    const delayMs = Math.max(0, Math.min(deadlineMs - Date.now(), RECHECK_INTERVAL_MS))
    const timer = setTimeout(() => {
      setNowMs(Date.now())
    }, delayMs)
    return () => {
      clearTimeout(timer)
    }
  }, [deadlineMs, nowMs])

  return nowMs
}
