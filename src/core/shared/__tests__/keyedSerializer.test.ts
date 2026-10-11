import { describe, expect, it } from 'vitest'
import { createKeyedSerializer } from '../keyedSerializer'

/** A promise that settles when the test says so. */
function deferred(): { promise: Promise<void>; open: () => void } {
  let open!: () => void
  const promise = new Promise<void>((resolve) => {
    open = resolve
  })
  return { promise, open }
}

describe('createKeyedSerializer', () => {
  it('runs tasks for the same key one at a time, in call order', async () => {
    const serializer = createKeyedSerializer()
    const log: string[] = []
    const gate = deferred()

    const first = serializer.run('a', async () => {
      log.push('first start')
      await gate.promise
      log.push('first end')
    })
    const second = serializer.run('a', () => {
      log.push('second start')
      return Promise.resolve()
    })
    await Promise.resolve()
    log.push('gate opens')
    gate.open()
    await Promise.all([first, second])

    expect(log).toEqual(['first start', 'gate opens', 'first end', 'second start'])
  })

  it('runs tasks for different keys at the same time', async () => {
    const serializer = createKeyedSerializer()
    const gate = deferred()
    const started: string[] = []

    const a = serializer.run('a', async () => {
      started.push('a')
      await gate.promise
    })
    const b = serializer.run('b', async () => {
      started.push('b')
      await gate.promise
    })
    await Promise.resolve()
    const startedWhileBothWait = [...started]
    gate.open()
    await Promise.all([a, b])

    expect(startedWhileBothWait).toEqual(['a', 'b'])
  })

  it('resolves each caller with its own task result', async () => {
    const serializer = createKeyedSerializer()

    const results = await Promise.all([
      serializer.run('a', () => Promise.resolve(1)),
      serializer.run('a', () => Promise.resolve('two'))
    ])

    expect(results).toEqual([1, 'two'])
  })

  it('rejects the caller whose task failed and still runs the next one', async () => {
    const serializer = createKeyedSerializer()
    const failing = serializer.run('a', () => Promise.reject(new Error('boom')))
    const next = serializer.run('a', () => Promise.resolve('after'))

    await expect(failing).rejects.toThrow('boom')
    await expect(next).resolves.toBe('after')
  })

  it('keeps no record of a key once its last task has finished', async () => {
    const serializer = createKeyedSerializer()

    await serializer.run('a', () => Promise.resolve())
    await serializer.run('b', () => Promise.resolve())
    await expect(serializer.run('c', () => Promise.reject(new Error('boom')))).rejects.toThrow()

    await new Promise((resolve) => setImmediate(resolve))
    expect(serializer.pendingKeys).toBe(0)
  })
})
