import { describe, expect, it } from 'vitest'
import { assistantRecordSchema } from '../schemas/assistantRecord'
import {
  buildAssistantRecord,
  buildAssistantRecordWithIterations,
  buildAssistantRecordWithUnknownFields
} from '../testFixtures'

describe('assistantRecordSchema', () => {
  it('accepts a well-formed assistant record', () => {
    expect(assistantRecordSchema.safeParse(buildAssistantRecord()).success).toBe(true)
  })

  it('accepts unknown extra fields (schema drift)', () => {
    expect(assistantRecordSchema.safeParse(buildAssistantRecordWithUnknownFields()).success).toBe(
      true
    )
  })

  it('accepts usage with several iterations', () => {
    const result = assistantRecordSchema.safeParse(buildAssistantRecordWithIterations())

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.message.usage.iterations).toHaveLength(2)
    }
  })

  it('accepts a null parentUuid', () => {
    const record = buildAssistantRecord({ parentUuid: null })

    expect(assistantRecordSchema.safeParse(record).success).toBe(true)
  })

  it('accepts a missing parentUuid', () => {
    const record = buildAssistantRecord()
    delete (record as { parentUuid?: unknown }).parentUuid

    expect(assistantRecordSchema.safeParse(record).success).toBe(true)
  })

  it('rejects a record missing the required message.id', () => {
    const record = {
      type: 'assistant',
      message: { model: 'claude-opus-5', usage: { input_tokens: 1, output_tokens: 1 } }
    }

    expect(assistantRecordSchema.safeParse(record).success).toBe(false)
  })

  it('rejects a record of a different type', () => {
    const record = { ...buildAssistantRecord(), type: 'user' }

    expect(assistantRecordSchema.safeParse(record).success).toBe(false)
  })

  it('rejects an oversized message.id', () => {
    const record = buildAssistantRecord({ messageId: 'x'.repeat(257) })

    expect(assistantRecordSchema.safeParse(record).success).toBe(false)
  })

  it('rejects an oversized message.model', () => {
    const record = buildAssistantRecord({ model: 'x'.repeat(257) })

    expect(assistantRecordSchema.safeParse(record).success).toBe(false)
  })

  it('accepts a message.id of exactly the cap', () => {
    const record = buildAssistantRecord({ messageId: 'x'.repeat(256) })

    expect(assistantRecordSchema.safeParse(record).success).toBe(true)
  })

  it('accepts a message.model of exactly the cap', () => {
    const record = buildAssistantRecord({ model: 'x'.repeat(256) })

    expect(assistantRecordSchema.safeParse(record).success).toBe(true)
  })
})
