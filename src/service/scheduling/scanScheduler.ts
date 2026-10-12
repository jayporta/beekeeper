/** Runs scans with a concurrency cap and shares one in-flight scan per key. */
export interface ScanScheduler {
  /**
   * Runs `task` in the foreground, unless a task with the same key is already
   * running or queued, in which case that one's result is shared. A shared
   * task that is still waiting in a background lane moves to the foreground.
   * @param key - Identifies the work, so duplicates can share it.
   * @param task - Starts the work.
   * @returns The task's result. A rejection reaches every caller sharing it.
   */
  run<T>(key: string, task: () => Promise<T>): Promise<T>
}

/**
 * A {@link ScanScheduler} with a second, background lane, for bulk work that
 * no one is waiting on.
 */
export interface LaneScanScheduler extends ScanScheduler {
  /**
   * Runs `task` in the background lane: it starts only when no foreground task
   * is waiting for a slot. Tasks sharing a key are shared across both lanes, as
   * in {@link ScanScheduler.run}, and a foreground caller of the key moves the
   * task to the foreground. Running tasks count toward the cap whichever lane
   * they came from.
   * @param key - Identifies the work, so duplicates can share it.
   * @param task - Starts the work.
   * @returns The task's result. A rejection reaches every caller sharing it.
   */
  runInBackground<T>(key: string, task: () => Promise<T>): Promise<T>
}

/** Options for {@link createScanScheduler}. */
export interface ScanSchedulerOptions {
  /** The most tasks that run at once. */
  readonly maxConcurrent: number
}

/** A task waiting for a slot. */
interface Waiting {
  readonly key: string
  readonly start: () => void
}

/**
 * Creates a scheduler. Large sessions are tens of megabytes of JSONL, so
 * capping concurrent scans bounds memory and disk pressure, and sharing
 * in-flight scans stops a double click from reading a file twice. Waiting
 * tasks start first come first served within their lane, and a free slot goes
 * to the foreground lane before the background one, so work a person is
 * waiting on never queues behind bulk work.
 *
 * @param options - The concurrency cap.
 * @returns A scheduler.
 */
export function createScanScheduler(options: ScanSchedulerOptions): LaneScanScheduler {
  const inFlight = new Map<string, Promise<unknown>>()
  const foreground: Waiting[] = []
  const background: Waiting[] = []
  let running = 0

  function startNext(): void {
    while (running < options.maxConcurrent) {
      const next = foreground.shift() ?? background.shift()
      if (next === undefined) return
      running += 1
      next.start()
    }
  }

  function promote(key: string): void {
    const index = background.findIndex((waiting) => waiting.key === key)
    if (index < 0) return
    foreground.push(...background.splice(index, 1))
  }

  const schedulerFor = (lane: Waiting[]) =>
    function schedule<T>(key: string, task: () => Promise<T>): Promise<T> {
      const shared = inFlight.get(key)
      if (shared !== undefined) {
        if (lane === foreground) promote(key)
        return shared as Promise<T>
      }

      const promise = new Promise<T>((resolve, reject) => {
        lane.push({
          key,
          start: () => {
            Promise.resolve()
              .then(task)
              .then(resolve, reject)
              .finally(() => {
                running -= 1
                startNext()
              })
          }
        })
      }).finally(() => inFlight.delete(key))
      inFlight.set(key, promise)
      startNext()
      return promise
    }

  return {
    run: schedulerFor(foreground),
    runInBackground: schedulerFor(background)
  }
}
