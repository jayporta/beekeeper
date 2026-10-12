import { describe, expect, it } from 'vitest'
import { createTestHost } from '../../../testHost'
import { startMod } from '../startMod'

describe('startMod', () => {
  it('is ready on the minimum version', async () => {
    const outcome = await startMod(createTestHost({ version: { version: '2.1.296' } }))

    expect(outcome).toEqual({ kind: 'ready' })
  })

  it('reports the version when Claude Code is too old', async () => {
    const outcome = await startMod(createTestHost({ version: { version: '2.1.100' } }))

    expect(outcome).toEqual({ kind: 'too-old', version: '2.1.100' })
  })

  it('maps a rejected version call to failed instead of rejecting', async () => {
    const version = (): never => {
      throw new Error('engine unavailable')
    }

    const outcome = await startMod(createTestHost({ version }))

    expect(outcome).toEqual({ kind: 'failed' })
  })
})
