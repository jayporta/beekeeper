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

const record = (started: string[], name: string) => (): Promise<string> => {
  started.push(name)
  return Promise.resolve(name)
}

describe('createScanScheduler background lane', () => {
  /** A scheduler of one slot, held by a first task until `release` is called. */
  function busyScheduler(): {
    scheduler: ReturnType<typeof createScanScheduler>
    release: () => void
    started: string[]
  } {
    const scheduler = createScanScheduler({ maxConcurrent: 1 })
    const gate = defer()
    const started: string[] = []
    void scheduler.run('holder', () => gate.promise)
    return { scheduler, release: () => gate.resolve('held'), started }
  }

  it('runs a foreground task queued after many background tasks before them', async () => {
    const { scheduler, release, started } = busyScheduler()
    const background = Array.from({ length: 20 }, (_unused, index) =>
      scheduler.runInBackground(`bg${index}`, record(started, `bg${index}`))
    )
    const foreground = scheduler.run('fg', record(started, 'fg'))

    release()
    await Promise.all([foreground, ...background])

    expect(started[0]).toBe('fg')
    expect(started.slice(1)).toEqual(background.map((_unused, index) => `bg${index}`))
  })

  it('runs background tasks first come first served among themselves', async () => {
    const { scheduler, release, started } = busyScheduler()
    const all = ['a', 'b', 'c'].map((name) =>
      scheduler.runInBackground(name, record(started, name))
    )

    release()
    await Promise.all(all)

    expect(started).toEqual(['a', 'b', 'c'])
  })

  it('starts a background task when nothing else is waiting', async () => {
    const scheduler = createScanScheduler({ maxConcurrent: 1 })

    await expect(scheduler.runInBackground('a', () => Promise.resolve('ran'))).resolves.toBe('ran')
  })

  it('counts running background tasks toward the cap', async () => {
    const scheduler = createScanScheduler({ maxConcurrent: 2 })
    const gates = [defer(), defer(), defer()]
    let active = 0
    let peak = 0
    const runs = gates.map((gate, index) =>
      scheduler.runInBackground(`bg${index}`, async () => {
        active += 1
        peak = Math.max(peak, active)
        try {
          return await gate.promise
        } finally {
          active -= 1
        }
      })
    )
    await tick()
    expect(active).toBe(2)
    for (const gate of gates) gate.resolve('x')
    await Promise.all(runs)

    expect(peak).toBe(2)
  })

  it('does not start a waiting background task ahead of a foreground one when a slot frees', async () => {
    const { scheduler, release, started } = busyScheduler()
    const background = scheduler.runInBackground('bg', record(started, 'bg'))
    const first = scheduler.run('fg1', record(started, 'fg1'))
    const second = scheduler.run('fg2', record(started, 'fg2'))

    release()
    await Promise.all([background, first, second])

    expect(started).toEqual(['fg1', 'fg2', 'bg'])
  })

  it('moves a queued background task to the foreground when a foreground caller asks for its key', async () => {
    const { scheduler, release, started } = busyScheduler()
    const background = Array.from({ length: 5 }, (_unused, index) =>
      scheduler.runInBackground(`bg${index}`, record(started, `bg${index}`))
    )
    const other = scheduler.run('fg', record(started, 'fg'))
    const promoted = scheduler.run('bg3', record(started, 'never'))

    release()
    await Promise.all([other, promoted, ...background])

    expect(started.slice(0, 2)).toEqual(['fg', 'bg3'])
    expect(started).not.toContain('never')
    expect(await promoted).toBe('bg3')
  })

  it('leaves the background queue alone when a foreground caller joins a task that is not queued there', async () => {
    const scheduler = createScanScheduler({ maxConcurrent: 1 })
    const gate = defer()
    const started: string[] = []
    const running = scheduler.run('running', () => gate.promise)
    const queued = ['a', 'b'].map((name) => scheduler.runInBackground(name, record(started, name)))

    const joined = scheduler.run('running', () => Promise.resolve('never'))
    gate.resolve('held')
    await Promise.all([running, joined, ...queued])

    expect(started).toEqual(['a', 'b'])
  })

  it('shares one run between a background caller and a foreground caller of the same key', async () => {
    const scheduler = createScanScheduler({ maxConcurrent: 2 })
    const gate = defer()
    let runs = 0
    const task = (): Promise<string> => {
      runs += 1
      return gate.promise
    }
    const first = scheduler.runInBackground('a', task)
    const second = scheduler.run('a', task)
    const third = scheduler.runInBackground('a', task)
    gate.resolve('done')

    expect(await Promise.all([first, second, third])).toEqual(['done', 'done', 'done'])
    expect(runs).toBe(1)
  })

  it('shares a foreground run with a later background caller of the same key', async () => {
    const scheduler = createScanScheduler({ maxConcurrent: 2 })
    const gate = defer()
    let runs = 0
    const task = (): Promise<string> => {
      runs += 1
      return gate.promise
    }
    const first = scheduler.run('a', task)
    const second = scheduler.runInBackground('a', task)
    gate.resolve('done')

    expect(await Promise.all([first, second])).toEqual(['done', 'done'])
    expect(runs).toBe(1)
  })

  it('keeps running queued work after a background task fails', async () => {
    const scheduler = createScanScheduler({ maxConcurrent: 1 })
    const failing = scheduler.runInBackground('a', () => Promise.reject(new Error('x')))
    const next = scheduler.runInBackground('b', () => Promise.resolve('b'))

    await expect(failing).rejects.toThrow('x')
    await expect(next).resolves.toBe('b')
  })

  it('lets a key run again after its background run has finished', async () => {
    const scheduler = createScanScheduler({ maxConcurrent: 1 })
    let runs = 0
    const task = (): Promise<number> => Promise.resolve(++runs)

    await scheduler.runInBackground('a', task)
    await scheduler.run('a', task)

    expect(runs).toBe(2)
  })
})
