import type { QueryClient } from '@tanstack/react-query'

/** Runs tasks with a cap on how many are in flight, first come first served. */
export interface Limiter {
  /**
   * Runs `task` once a slot is free. A task that is still waiting when `signal`
   * aborts never starts: the call rejects with the signal's reason.
   *
   * @param task - Starts the work.
   * @param signal - Aborts the wait for a slot.
   * @returns The task's result.
   */
  run<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T>
}

/**
 * Creates a limiter.
 *
 * @param max - The most tasks in flight at once.
 * @returns The limiter.
 */
export function createLimiter(max: number): Limiter {
  const waiting: (() => void)[] = []
  let running = 0

  function startNext(): void {
    while (running < max) {
      const start = waiting.shift()
      if (start === undefined) return
      running += 1
      start()
    }
  }

  return {
    run<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        waiting.push(() => {
          const release = (): void => {
            running -= 1
            startNext()
          }
          if (signal?.aborted === true) {
            release()
            reject(signal.reason)
            return
          }
          Promise.resolve().then(task).then(resolve, reject).finally(release)
        })
        startNext()
      })
    }
  }
}

/** How many folders' totals the renderer asks main for at once. */
export const MAX_TOTALS_IN_FLIGHT = 2

const limiters = new WeakMap<QueryClient, Limiter>()

/**
 * Gives the limiter for a query client's totals requests. Every reader of the
 * totals shares it, so the sidebar and the overview together never ask for
 * more than {@link MAX_TOTALS_IN_FLIGHT} folders at a time, which bounds the
 * summary reads queued at once. Main reads a folder's sessions in the
 * summaries scheduler's background lane, so a session list a person asks for
 * is not queued behind them; this limiter does not do that.
 *
 * @param client - The query client the requests belong to.
 * @returns The client's limiter.
 */
export function totalsLimiterFor(client: QueryClient): Limiter {
  let limiter = limiters.get(client)
  if (limiter === undefined) {
    limiter = createLimiter(MAX_TOTALS_IN_FLIGHT)
    limiters.set(client, limiter)
  }
  return limiter
}
