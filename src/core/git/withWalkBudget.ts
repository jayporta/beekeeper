import { FsTimeoutError, type FsRunner } from './fsDeadline'

/**
 * Wraps a runner so no call outlasts a shared deadline: a call that is still
 * pending when `deadlineAt` arrives rejects with an {@link FsTimeoutError}, on
 * top of whatever deadline `run` applies itself.
 *
 * @remarks
 * A call submitted once the deadline has passed rejects without starting.
 * The wrapper's timer is cleared when the call settles and never keeps the
 * process alive. A call it gave up on is still tracked by `run`, which keeps
 * its slot until the call settles. When the budget ends while a call is still
 * queued in `run`, the walk stops at once, but that queued call is not
 * withdrawn and may still start if a slot frees before `run`'s own deadline,
 * so at most one call per abandoned walk can run after the walk has ended.
 *
 * @param run - The runner that starts each call.
 * @param deadlineAt - When the budget ends, in `Date.now()` milliseconds.
 * @returns A runner that shares `deadlineAt` across every call.
 */
export function withWalkBudget(run: FsRunner, deadlineAt: number): FsRunner {
  return <T>(call: () => Promise<T>): Promise<T> => {
    const remaining = deadlineAt - Date.now()
    if (remaining <= 0) return Promise.reject(new FsTimeoutError())
    const expired = Promise.withResolvers<never>()
    const timer = setTimeout(() => expired.reject(new FsTimeoutError()), remaining)
    timer.unref()
    return Promise.race([run(call), expired.promise]).finally(() => clearTimeout(timer))
  }
}
