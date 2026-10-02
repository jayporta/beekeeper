import { useEffect, useState } from 'react'

/** The longest delay `setTimeout` honors, in milliseconds. A longer one fires at once. */
export const MAX_TIMER_DELAY_MS = 2_147_483_647

/**
 * Reads the current time, and moves it forward once when a deadline arrives so
 * what depends on the deadline can update while the view stays open.
 *
 * @param deadlineMs - The time to wake at, in milliseconds since the Unix epoch,
 * or `null` for none. No timer is set for a deadline that has already passed or
 * is further away than the longest delay `setTimeout` supports.
 * @returns The time the hook mounted at, or the time the deadline arrived once
 * it has.
 * @example
 * const nowMs = useNowUntil(hit === null ? null : hit.resetsAtMs)
 */
export function useNowUntil(deadlineMs: number | null): number {
  const [nowMs, setNowMs] = useState(Date.now)

  useEffect(() => {
    if (deadlineMs === null) return
    const delayMs = deadlineMs - nowMs
    if (delayMs <= 0 || delayMs > MAX_TIMER_DELAY_MS) return
    const timer = setTimeout(() => {
      setNowMs(Date.now())
    }, delayMs)
    return () => {
      clearTimeout(timer)
    }
  }, [deadlineMs, nowMs])

  return nowMs
}
