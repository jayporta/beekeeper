import { describe, expect, it } from 'vitest'
import { createSerialQueue } from '../serialQueue'

describe('createSerialQueue', () => {
  it('runs tasks one at a time, in the order they were queued', async () => {
    const run = createSerialQueue()
    const events: string[] = []
    const task = (name: string, delayMs: number) => async (): Promise<string> => {
      events.push(`${name} start`)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
      events.push(`${name} end`)
      return name
    }

    const results = await Promise.all([run(task('a', 30)), run(task('b', 1))])

    expect(results).toEqual(['a', 'b'])
    expect(events).toEqual(['a start', 'a end', 'b start', 'b end'])
  })

  it('rejects the failed task and still runs the next one', async () => {
    const run = createSerialQueue()
    const failed = run(() => Promise.reject(new Error('boom')))

    const next = run(() => Promise.resolve('ok'))

    await expect(failed).rejects.toThrow('boom')
    expect(await next).toBe('ok')
  })
})
