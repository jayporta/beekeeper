/** The default deadline for one filesystem call, in milliseconds. */
export const DEFAULT_FS_DEADLINE_MS = 5000

/** The default cap on filesystem calls that have started and not yet settled. */
export const DEFAULT_MAX_UNSETTLED = 2

/** Thrown by an {@link FsRunner} when a queued or running call passes its deadline. */
export class FsTimeoutError extends Error {
  constructor() {
    super('fs-timeout')
    this.name = 'FsTimeoutError'
  }
}

/**
 * Whether a caught value is the timeout an {@link FsRunner} raises.
 * @param error - The value caught from a failed call.
 * @returns `true` for an {@link FsTimeoutError}.
 */
export function isFsTimeout(error: unknown): error is FsTimeoutError {
  return error instanceof FsTimeoutError
}

/** Runs one filesystem call under a deadline, passing its result or rejection through. */
export type FsRunner = <T>(call: () => Promise<T>) => Promise<T>

/** Options for {@link createFsRunner}. */
export interface FsRunnerOptions {
  /** Milliseconds, from the moment a call is submitted, before it is given up on. Defaults to {@link DEFAULT_FS_DEADLINE_MS}. */
  readonly deadlineMs?: number
  /** Most calls that may hold a thread at once, running or abandoned. Defaults to {@link DEFAULT_MAX_UNSETTLED}. */
  readonly maxUnsettled?: number
}

/**
 * Creates a runner that puts a deadline on filesystem calls and caps how many
 * of them hold a thread.
 *
 * @remarks
 * A call on a hung mount can't be cancelled, and it holds one of libuv's few
 * threadpool threads until the operating system gives up. A runner starts at
 * most `maxUnsettled` calls that have not settled, counting both running calls
 * and ones it gave up on. A call submitted over the cap waits in a first-in,
 * first-out queue, and its deadline runs from submission. A call still queued
 * at its deadline is rejected without ever starting, including one whose
 * deadline passed before its timer fired when a slot freed. A call that has
 * started is rejected at its deadline but keeps its slot until it actually
 * settles, and then the next queued call starts. So at most `maxUnsettled`
 * calls hold threads at any moment, and while hung calls fill every slot, new
 * calls time out at their deadline instead of starting. Timers never keep the
 * process alive.
 *
 * @param options - The deadline and the cap.
 * @returns A runner. Each runner has its own cap and queue.
 */
export function createFsRunner(options: FsRunnerOptions = {}): FsRunner {
  const deadlineMs = options.deadlineMs ?? DEFAULT_FS_DEADLINE_MS
  const maxUnsettled = options.maxUnsettled ?? DEFAULT_MAX_UNSETTLED
  let unsettled = 0
  const queue: Array<() => void> = []

  const release = (): void => {
    unsettled -= 1
    queue.shift()?.()
  }

  return <T>(call: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const submittedAt = Date.now()
      const start = (): void => {
        if (Date.now() - submittedAt >= deadlineMs) {
          clearTimeout(timer)
          reject(new FsTimeoutError())
          queue.shift()?.()
          return
        }
        unsettled += 1
        let pending: Promise<T>
        try {
          pending = call()
        } catch (error) {
          clearTimeout(timer)
          reject(error)
          release()
          return
        }
        const settle = (deliver: () => void): void => {
          clearTimeout(timer)
          deliver()
          release()
        }
        pending.then(
          (value) => settle(() => resolve(value)),
          (error: unknown) => settle(() => reject(error))
        )
      }

      const timer = setTimeout(() => {
        const queued = queue.indexOf(start)
        if (queued !== -1) queue.splice(queued, 1)
        reject(new FsTimeoutError())
      }, deadlineMs)
      timer.unref()

      if (unsettled < maxUnsettled) start()
      else queue.push(start)
    })
}

/** The runner every git-flow filesystem call uses unless a caller injects another. */
export const defaultFsRunner: FsRunner = createFsRunner()
