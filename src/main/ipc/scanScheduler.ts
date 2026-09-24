/** Runs scans with a concurrency cap and shares one in-flight scan per key. */
export interface ScanScheduler {
  /**
   * Runs `task`, unless a task with the same key is already running or
   * queued, in which case that one's result is shared.
   * @param key - Identifies the work, so duplicates can share it.
   * @param task - Starts the work.
   * @returns The task's result. A rejection reaches every caller sharing it.
   */
  run<T>(key: string, task: () => Promise<T>): Promise<T>
}

/** Options for {@link createScanScheduler}. */
export interface ScanSchedulerOptions {
  /** The most tasks that run at once. */
  readonly maxConcurrent: number
}

/**
 * Creates a scheduler. Large sessions are tens of megabytes of JSONL, so
 * capping concurrent scans bounds memory and disk pressure, and sharing
 * in-flight scans stops a double click from reading a file twice.
 *
 * @param options - The concurrency cap.
 * @returns A scheduler.
 */
export function createScanScheduler(options: ScanSchedulerOptions): ScanScheduler {
  const inFlight = new Map<string, Promise<unknown>>()
  const waiting: (() => void)[] = []
  let running = 0

  function startNext(): void {
    while (running < options.maxConcurrent) {
      const start = waiting.shift()
      if (start === undefined) return
      running += 1
      start()
    }
  }

  return {
    run<T>(key: string, task: () => Promise<T>): Promise<T> {
      const shared = inFlight.get(key)
      if (shared !== undefined) return shared as Promise<T>

      const promise = new Promise<T>((resolve, reject) => {
        waiting.push(() => {
          Promise.resolve()
            .then(task)
            .then(resolve, reject)
            .finally(() => {
              running -= 1
              startNext()
            })
        })
      }).finally(() => inFlight.delete(key))
      inFlight.set(key, promise)
      startNext()
      return promise
    }
  }
}
