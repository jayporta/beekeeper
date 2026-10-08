import type { DayKey } from '../../core/usage/dailyUsage'

/**
 * The IANA name of the time zone this process runs in, read each time since
 * the system's zone can change while the app runs.
 *
 * @returns The host's time zone, such as `America/Los_Angeles`.
 */
export function hostTimeZone(): string {
  return new Intl.DateTimeFormat().resolvedOptions().timeZone
}

/** A quarter hour, in milliseconds. Every UTC offset is a whole number of them, so no local midnight falls inside one. */
const SLOT_MS = 15 * 60 * 1000

/**
 * Builds a mapping from an instant to its calendar day in a time zone. The
 * day is assembled from the formatter's parts, so it doesn't depend on a
 * locale's field order. The last quarter hour and its day are remembered, so
 * a run of instants close together formats once.
 *
 * @param timeZone - An IANA time zone name. Defaults to the host's.
 * @returns A function from epoch milliseconds to the local `YYYY-MM-DD`.
 * @throws {RangeError} When `timeZone` is not a valid time zone.
 */
export function createDayKeyOf(timeZone?: string): (epochMs: number) => DayKey {
  const format = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
  let lastSlot = Number.NaN
  let lastDay = ''
  return (epochMs) => {
    const slot = Math.floor(epochMs / SLOT_MS)
    if (slot !== lastSlot) {
      const parts = new Map(format.formatToParts(epochMs).map(({ type, value }) => [type, value]))
      lastDay = `${parts.get('year')}-${parts.get('month')}-${parts.get('day')}`
      lastSlot = slot
    }
    return lastDay
  }
}
