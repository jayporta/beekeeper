import { describe, expect, it } from 'vitest'
import { createScanScheduler } from '../scanScheduler'

const defer = (): PromiseWithResolvers<string> => Promise.withResolvers<string>()

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

describe('createScanScheduler', () => {
  it('shares one run between concurrent callers with the same key', async () => {
    const scheduler = createScanScheduler({ maxConcurrent: 2 })
    const gate = defer()
    let runs = 0
    const task = (): Promise<string> => {
      runs += 1
      return gate.promise
    }
    const first = scheduler.run('a', task)
    const second = scheduler.run('a', task)
    gate.resolve('done')
    expect(await first).toBe('done')
    expect(await second).toBe('done')
    expect(runs).toBe(1)
  })

  it('runs again once the earlier run has finished', async () => {
    const scheduler = createScanScheduler({ maxConcurrent: 2 })
    let runs = 0
    const task = (): Promise<number> => Promise.resolve(++runs)
    await scheduler.run('a', task)
    await scheduler.run('a', task)
    expect(runs).toBe(2)
  })

  it('never runs more than the cap at once and starts queued work as slots free', async () => {
    const scheduler = createScanScheduler({ maxConcurrent: 2 })
    const gates = [defer(), defer(), defer(), defer()]
    let active = 0
    let peak = 0
    const started: number[] = []
    const runs = gates.map((gate, index) =>
      scheduler.run(`k${index}`, async () => {
        active += 1
        peak = Math.max(peak, active)
        started.push(index)
        try {
          return await gate.promise
        } finally {
          active -= 1
        }
      })
    )
    await tick()
    expect(started).toEqual([0, 1])
    gates[0]?.resolve('0')
    await tick()
    expect(started).toEqual([0, 1, 2])
    gates[1]?.resolve('1')
    gates[2]?.resolve('2')
    gates[3]?.resolve('3')
    expect(await Promise.all(runs)).toEqual(['0', '1', '2', '3'])
    expect(peak).toBe(2)
  })

  it('rejects every caller sharing a failed run and then allows a retry', async () => {
    const scheduler = createScanScheduler({ maxConcurrent: 1 })
    const gate = defer()
    const first = scheduler.run('a', () => gate.promise)
    const second = scheduler.run('a', () => gate.promise)
    gate.reject(new Error('boom'))
    await expect(first).rejects.toThrow('boom')
    await expect(second).rejects.toThrow('boom')
    await expect(scheduler.run('a', () => Promise.resolve('ok'))).resolves.toBe('ok')
  })

  it('keeps running queued work after a task fails', async () => {
    const scheduler = createScanScheduler({ maxConcurrent: 1 })
    const failing = scheduler.run('a', () => Promise.reject(new Error('x')))
    const next = scheduler.run('b', () => Promise.resolve('b'))
    await expect(failing).rejects.toThrow('x')
    await expect(next).resolves.toBe('b')
  })

  it('rejects a task that throws synchronously, frees its slot, and lets the key retry', async () => {
    const scheduler = createScanScheduler({ maxConcurrent: 1 })
    const throwing = (): Promise<string> => {
      throw new Error('sync')
    }
    await expect(scheduler.run('a', throwing)).rejects.toThrow('sync')
    await expect(scheduler.run('a', () => Promise.resolve('again'))).resolves.toBe('again')
    await expect(scheduler.run('b', () => Promise.resolve('b'))).resolves.toBe('b')
  })
})
