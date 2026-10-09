/** The least time between two refreshes of the session details: 10 seconds. A detail scan reads a whole session, so it is slower than a list's. */
export const DETAIL_LIVE_INTERVAL_MS = 10_000

/** The project families to refresh, or `all`. */
export type Families = ReadonlySet<string> | 'all'

/** What {@link createDetailThrottle} needs from its caller. */
export interface DetailThrottleOptions {
  /** Receives the merged families when the interval ends or on `flush`. */
  readonly onFlush: (families: Families) => void
  /** Starts a timer that calls `run` once after `ms`, and returns a handle for `clearTimer`. */
  readonly setTimer: (run: () => void, ms: number) => unknown
  /** Cancels a timer started by `setTimer`. */
  readonly clearTimer: (handle: unknown) => void
}

/** Holds back session detail refreshes so they run at most once per interval. */
export interface DetailThrottle {
  /** Adds families to refresh. The first add of a round starts the interval. */
  add(families: Families): void
  /** Refreshes what is waiting now, and ends the round. */
  flush(): void
  /** Drops what is waiting without refreshing it. */
  cancel(): void
}

/**
 * Throttles the refresh of session details to one per {@link DETAIL_LIVE_INTERVAL_MS}.
 * The families added during a round merge, and `all` wins over any set. The
 * round starts with its first add and ends by flushing once the interval has
 * passed, so a change is refreshed at most one interval after it arrives.
 *
 * @param options - Where flushes go and the timer functions to use.
 * @returns The throttle.
 */
export function createDetailThrottle(options: DetailThrottleOptions): DetailThrottle {
  const { onFlush, setTimer, clearTimer } = options
  let pending: Families | null = null
  let timer: unknown = null

  function cancel(): void {
    if (timer !== null) clearTimer(timer)
    timer = null
    pending = null
  }

  function flush(): void {
    const families = pending
    cancel()
    if (families !== null) onFlush(families)
  }

  return {
    add(families) {
      pending =
        pending === null
          ? families
          : pending === 'all' || families === 'all'
            ? 'all'
            : new Set([...pending, ...families])
      timer ??= setTimer(flush, DETAIL_LIVE_INTERVAL_MS)
    },
    flush,
    cancel
  }
}
