import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFsRunner, FsTimeoutError, isFsTimeout } from '../fsDeadline'
import { neverSettles } from '../testFsRunner'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

/** A call the test settles by hand, and a count of how often it was started. */
interface ManualCall<T> {
  readonly call: () => Promise<T>
  readonly started: () => number
  readonly resolve: (value: T) => void
}

function manualCall<T>(): ManualCall<T> {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  let started = 0
  return {
    call: () => {
      started += 1
      return promise
    },
    started: () => started,
    resolve
  }
}

/** Records how a promise settles, without failing the test on a rejection. */
function watch<T>(promise: Promise<T>): { outcome: () => 'pending' | 'resolved' | 'rejected' } {
  let outcome: 'pending' | 'resolved' | 'rejected' = 'pending'
  promise.then(
    () => (outcome = 'resolved'),
    () => (outcome = 'rejected')
  )
  return { outcome: () => outcome }
}

describe('createFsRunner deadline', () => {
  it('rejects with a timeout only once the deadline is reached', async () => {
    const run = createFsRunner({ deadlineMs: 100 })
    const pending = run(neverSettles)
    const watched = watch(pending)
    const settled = expect(pending).rejects.toSatisfy(isFsTimeout)

    await vi.advanceTimersByTimeAsync(99)
    expect(watched.outcome()).toBe('pending')
    await vi.advanceTimersByTimeAsync(1)

    await settled
    expect(watched.outcome()).toBe('rejected')
  })

  it('passes a value through when the call settles before the deadline', async () => {
    const run = createFsRunner({ deadlineMs: 100 })

    expect(await run(() => Promise.resolve('real'))).toBe('real')
  })

  it('passes a rejection such as ENOENT through unchanged', async () => {
    const run = createFsRunner({ deadlineMs: 100 })
    const failure = Object.assign(new Error('missing'), { code: 'ENOENT' })

    await expect(run(() => Promise.reject(failure))).rejects.toBe(failure)
  })

  it('rejects with the error when the call throws before returning a promise', async () => {
    const run = createFsRunner({ deadlineMs: 100 })
    const failure = new Error('sync')

    await expect(
      run(() => {
        throw failure
      })
    ).rejects.toBe(failure)
  })

  it('frees the slot of a call that throws before returning a promise', async () => {
    const run = createFsRunner({ deadlineMs: 100, maxUnsettled: 1 })
    await run(() => {
      throw new Error('sync')
    }).catch(() => undefined)

    expect(await run(() => Promise.resolve('next'))).toBe('next')
  })

  it('clears its timer once the call settles', async () => {
    const run = createFsRunner({ deadlineMs: 100 })

    await run(() => Promise.resolve(1))

    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('createFsRunner unsettled cap', () => {
  it('starts no more than the cap out of a burst of calls', () => {
    const run = createFsRunner({ deadlineMs: 100, maxUnsettled: 2 })
    const calls = Array.from({ length: 5 }, () => manualCall<string>())

    for (const { call } of calls) watch(run(call))

    expect(calls.map((entry) => entry.started())).toEqual([1, 1, 0, 0, 0])
  })

  it('rejects a queued call at its deadline and never starts it, even after a slot frees', async () => {
    const run = createFsRunner({ deadlineMs: 100, maxUnsettled: 1 })
    const running = manualCall<string>()
    watch(run(running.call))
    const queued = manualCall<string>()
    const settled = expect(run(queued.call)).rejects.toBeInstanceOf(FsTimeoutError)

    await vi.advanceTimersByTimeAsync(100)
    await settled
    running.resolve('late')
    await vi.advanceTimersByTimeAsync(0)

    expect(queued.started()).toBe(0)
  })

  it('rejects a queued call whose deadline passed before its timer fired, and starts the one behind it', async () => {
    const run = createFsRunner({ deadlineMs: 100, maxUnsettled: 1 })
    const running = manualCall<string>()
    const runningResult = run(running.call)
    const expired = manualCall<string>()
    const expiredSettled = expect(run(expired.call)).rejects.toBeInstanceOf(FsTimeoutError)
    vi.setSystemTime(Date.now() + 200)
    const fresh = manualCall<string>()
    const freshResult = run(fresh.call)

    running.resolve('done')
    await runningResult
    await expiredSettled

    expect(expired.started()).toBe(0)
    expect(fresh.started()).toBe(1)
    fresh.resolve('fresh')
    expect(await freshResult).toBe('fresh')
  })

  it('starts the next queued call, in order, when a running call settles', async () => {
    const run = createFsRunner({ deadlineMs: 100, maxUnsettled: 1 })
    const first = manualCall<string>()
    const second = manualCall<string>()
    const third = manualCall<string>()
    const firstResult = run(first.call)
    const secondResult = run(second.call)
    watch(run(third.call))

    first.resolve('first')
    await firstResult
    expect([second.started(), third.started()]).toEqual([1, 0])
    second.resolve('second')

    expect(await secondResult).toBe('second')
    expect(third.started()).toBe(1)
  })

  it('keeps the slot of an abandoned call until it settles late, then starts the next queued call', async () => {
    const run = createFsRunner({ deadlineMs: 100, maxUnsettled: 1 })
    const abandoned = manualCall<string>()
    const firstSettled = expect(run(abandoned.call)).rejects.toBeInstanceOf(FsTimeoutError)
    await vi.advanceTimersByTimeAsync(60)
    const queued = manualCall<string>()
    const queuedResult = run(queued.call)
    await vi.advanceTimersByTimeAsync(40)
    await firstSettled
    expect(queued.started()).toBe(0)

    abandoned.resolve('late')
    await vi.advanceTimersByTimeAsync(0)
    queued.resolve('queued')

    expect(await queuedResult).toBe('queued')
    expect(queued.started()).toBe(1)
  })

  it('starts a call at once while hung calls leave a slot free', async () => {
    const run = createFsRunner({ deadlineMs: 100, maxUnsettled: 2 })
    watch(run(neverSettles))

    expect(await run(() => Promise.resolve('ok'))).toBe('ok')
  })
})

describe('isFsTimeout', () => {
  it('is false for other errors', () => {
    expect(isFsTimeout(new Error('fs-timeout'))).toBe(false)
  })
})
