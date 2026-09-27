import { describe, expect, it } from 'vitest'
import { MAX_IDENTIFIER_CODE_UNITS } from '../schemas/boundedIdentifier'
import { toolUseBlockSchema } from '../schemas/toolUseBlock'
import { buildToolUseBlock } from '../testFileTouchFixtures'

describe('toolUseBlockSchema', () => {
  it('accepts a well-formed tool_use block', () => {
    expect(toolUseBlockSchema.safeParse(buildToolUseBlock()).success).toBe(true)
  })

  it('accepts unknown extra fields (schema drift)', () => {
    const block = { ...buildToolUseBlock(), futureField: 'unreleased' }

    expect(toolUseBlockSchema.safeParse(block).success).toBe(true)
  })

  it('rejects a block missing the required id', () => {
    const block = buildToolUseBlock({ id: undefined })

    expect(toolUseBlockSchema.safeParse(block).success).toBe(false)
  })

  it('rejects a block missing the required name', () => {
    const block = buildToolUseBlock({ name: undefined })

    expect(toolUseBlockSchema.safeParse(block).success).toBe(false)
  })

  it('rejects a block of a different type', () => {
    const block = { ...buildToolUseBlock(), type: 'text' }

    expect(toolUseBlockSchema.safeParse(block).success).toBe(false)
  })

  it('accepts an id and name of exactly the cap', () => {
    const block = buildToolUseBlock({
      id: 'x'.repeat(MAX_IDENTIFIER_CODE_UNITS),
      name: 'x'.repeat(MAX_IDENTIFIER_CODE_UNITS)
    })

    expect(toolUseBlockSchema.safeParse(block).success).toBe(true)
  })

  it('rejects an id one code unit over the cap', () => {
    const block = buildToolUseBlock({ id: 'x'.repeat(MAX_IDENTIFIER_CODE_UNITS + 1) })

    expect(toolUseBlockSchema.safeParse(block).success).toBe(false)
  })

  it('rejects a name one code unit over the cap', () => {
    const block = buildToolUseBlock({ name: 'x'.repeat(MAX_IDENTIFIER_CODE_UNITS + 1) })

    expect(toolUseBlockSchema.safeParse(block).success).toBe(false)
  })

  it('rejects an id under the code-point cap but over the code-unit cap', () => {
    // 200 non-BMP characters: 200 code points, but 400 UTF-16 code units.
    const block = buildToolUseBlock({ id: '😀'.repeat(200) })

    expect(toolUseBlockSchema.safeParse(block).success).toBe(false)
  })
})
