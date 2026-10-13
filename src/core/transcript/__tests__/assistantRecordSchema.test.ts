import { describe, expect, it } from 'vitest'
import { assistantRecordSchema } from '../schemas/assistantRecord'
import { MAX_IDENTIFIER_CODE_UNITS } from '../schemas/boundedIdentifier'
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

  it('accepts a malformed isSidechain and parentUuid, which it does not read', () => {
    const record = buildAssistantRecord({ extra: { isSidechain: 'yes', parentUuid: 42 } })

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
    const record = buildAssistantRecord({ messageId: 'x'.repeat(MAX_IDENTIFIER_CODE_UNITS + 1) })

    expect(assistantRecordSchema.safeParse(record).success).toBe(false)
  })

  it('rejects an oversized message.model', () => {
    const record = buildAssistantRecord({ model: 'x'.repeat(MAX_IDENTIFIER_CODE_UNITS + 1) })

    expect(assistantRecordSchema.safeParse(record).success).toBe(false)
  })

  it('accepts a message.id of exactly the cap', () => {
    const record = buildAssistantRecord({ messageId: 'x'.repeat(MAX_IDENTIFIER_CODE_UNITS) })

    expect(assistantRecordSchema.safeParse(record).success).toBe(true)
  })

  it('accepts a message.model of exactly the cap', () => {
    const record = buildAssistantRecord({ model: 'x'.repeat(MAX_IDENTIFIER_CODE_UNITS) })

    expect(assistantRecordSchema.safeParse(record).success).toBe(true)
  })

  it('rejects a message.id under the code-point cap but over the code-unit cap', () => {
    // 200 non-BMP characters: 200 code points, but 400 UTF-16 code units.
    const record = buildAssistantRecord({ messageId: '😀'.repeat(200) })

    expect(assistantRecordSchema.safeParse(record).success).toBe(false)
  })

  it('rejects a message.model under the code-point cap but over the code-unit cap', () => {
    const record = buildAssistantRecord({ model: '😀'.repeat(200) })

    expect(assistantRecordSchema.safeParse(record).success).toBe(false)
  })

  it.each([
    ['a bidi override', 'claude\u202Eopus'],
    ['a line separator', 'claude\u2028opus'],
    ['a control character', 'claude\u0007opus']
  ])('rejects a message.model with %s', (_label, model) => {
    expect(assistantRecordSchema.safeParse(buildAssistantRecord({ model })).success).toBe(false)
  })
})
