import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { MAX_TOTALS_IN_FLIGHT, createLimiter, totalsLimiterFor } from '../totalsLimiter'

/** A task that holds its slot until released. */
function gate(): { task: () => Promise<string>; release: () => void; started: () => boolean } {
  let release = (): void => {}
  let started = false
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  return {
    task: async () => {
      started = true
      await held
      return 'done'
    },
    release,
    started: () => started
  }
}

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

describe('createLimiter', () => {
  it('runs tasks up to the cap at once and holds the rest', async () => {
    const limiter = createLimiter(2)
    const gates = [gate(), gate(), gate(), gate()]

    for (const g of gates) void limiter.run(g.task)
    await settle()

    expect(gates.map((g) => g.started())).toEqual([true, true, false, false])
  })

  it('starts the next waiting task, in order, as each slot frees', async () => {
    const limiter = createLimiter(1)
    const gates = [gate(), gate(), gate()]
    for (const g of gates) void limiter.run(g.task)
    await settle()

    gates[0]?.release()
    await settle()
    expect(gates.map((g) => g.started())).toEqual([true, true, false])

    gates[1]?.release()
    await settle()
    expect(gates.map((g) => g.started())).toEqual([true, true, true])
  })

  it('resolves with the task’s result', async () => {
    expect(await createLimiter(2).run(() => Promise.resolve(7))).toBe(7)
  })

  it('rejects with the task’s failure, and still frees its slot', async () => {
    const limiter = createLimiter(1)

    await expect(limiter.run(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom')

    expect(await limiter.run(() => Promise.resolve('next'))).toBe('next')
  })

  it('never starts a task whose wait was aborted, and passes its slot on', async () => {
    const limiter = createLimiter(1)
    const first = gate()
    const aborted = new AbortController()
    let ran = false
    void limiter.run(first.task)
    const waiting = limiter.run(() => {
      ran = true
      return Promise.resolve('x')
    }, aborted.signal)
    const after = limiter.run(() => Promise.resolve('after'))

    aborted.abort(new Error('cancelled'))
    first.release()

    await expect(waiting).rejects.toThrow('cancelled')
    expect(await after).toBe('after')
    expect(ran).toBe(false)
  })

  it('runs a task whose signal is not aborted', async () => {
    const result = await createLimiter(1).run(
      () => Promise.resolve('ok'),
      new AbortController().signal
    )

    expect(result).toBe('ok')
  })
})

describe('totalsLimiterFor', () => {
  it('allows two folders at a time', () => {
    expect(MAX_TOTALS_IN_FLIGHT).toBe(2)
  })

  it('gives one limiter per query client, shared by every reader', () => {
    const client = new QueryClient()

    expect(totalsLimiterFor(client)).toBe(totalsLimiterFor(client))
    expect(totalsLimiterFor(new QueryClient())).not.toBe(totalsLimiterFor(client))
  })
})
