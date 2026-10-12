import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { okResult } from '../../../service/ipcResults'
import { parseThen } from '../parseThen'

const schema = z.strictObject({ name: z.string() })

describe('parseThen', () => {
  it('answers invalid-request without running the call for a payload the schema rejects', async () => {
    const run = vi.fn(() => Promise.resolve(okResult('done')))

    const result = await parseThen({ schema, run })({ name: 1 })

    expect(result).toEqual({ ok: false, error: { code: 'invalid-request' } })
    expect(run).not.toHaveBeenCalled()
  })

  it('runs the call once with the parsed data for a payload the schema accepts', async () => {
    const run = vi.fn((request: { name: string }) => Promise.resolve(okResult(request.name)))

    const result = await parseThen({ schema, run })({ name: 'a' })

    expect(result).toEqual({ ok: true, value: 'a' })
    expect(run).toHaveBeenCalledExactlyOnceWith({ name: 'a' })
  })
})
