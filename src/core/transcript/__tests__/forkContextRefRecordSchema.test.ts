import { describe, expect, it } from 'vitest'
import { forkContextRefRecordSchema } from '../schemas/forkContextRefRecord'
import { buildForkContextRefRecord } from '../testFixtures'

describe('forkContextRefRecordSchema', () => {
  it('accepts a well-formed fork-context-ref record', () => {
    expect(forkContextRefRecordSchema.safeParse(buildForkContextRefRecord()).success).toBe(true)
  })

  it('accepts unknown extra fields (schema drift)', () => {
    const record = { ...buildForkContextRefRecord(), futureField: 'unreleased' }

    expect(forkContextRefRecordSchema.safeParse(record).success).toBe(true)
  })

  it('rejects a record missing the required parentSessionId', () => {
    const record = buildForkContextRefRecord({ parentSessionId: undefined })

    expect(forkContextRefRecordSchema.safeParse(record).success).toBe(false)
  })

  it('rejects a record missing the required contextLength', () => {
    const record = buildForkContextRefRecord({ contextLength: undefined })

    expect(forkContextRefRecordSchema.safeParse(record).success).toBe(false)
  })

  it('rejects a record of a different type', () => {
    const record = { ...buildForkContextRefRecord(), type: 'assistant' }

    expect(forkContextRefRecordSchema.safeParse(record).success).toBe(false)
  })
})
