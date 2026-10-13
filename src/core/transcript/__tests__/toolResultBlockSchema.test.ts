import { describe, expect, it } from 'vitest'
import { MAX_IDENTIFIER_CODE_UNITS } from '../schemas/boundedIdentifier'
import { toolResultBlockSchema } from '../schemas/toolResultBlock'
import { buildToolResultBlock } from '../testFileTouchFixtures'

describe('toolResultBlockSchema', () => {
  it('accepts a well-formed tool_result block', () => {
    expect(toolResultBlockSchema.safeParse(buildToolResultBlock()).success).toBe(true)
  })

  it('accepts unknown extra fields (schema drift)', () => {
    const block = { ...buildToolResultBlock(), is_error: false }

    expect(toolResultBlockSchema.safeParse(block).success).toBe(true)
  })

  it('rejects a block missing the required tool_use_id', () => {
    const block = buildToolResultBlock({ tool_use_id: undefined })

    expect(toolResultBlockSchema.safeParse(block).success).toBe(false)
  })

  it('rejects a block of a different type', () => {
    const block = { ...buildToolResultBlock(), type: 'text' }

    expect(toolResultBlockSchema.safeParse(block).success).toBe(false)
  })

  it('accepts a tool_use_id of exactly the cap', () => {
    const block = buildToolResultBlock({ tool_use_id: 'x'.repeat(MAX_IDENTIFIER_CODE_UNITS) })

    expect(toolResultBlockSchema.safeParse(block).success).toBe(true)
  })

  it('rejects a tool_use_id one code unit over the cap', () => {
    const block = buildToolResultBlock({ tool_use_id: 'x'.repeat(MAX_IDENTIFIER_CODE_UNITS + 1) })

    expect(toolResultBlockSchema.safeParse(block).success).toBe(false)
  })

  it('rejects a tool_use_id under the code-point cap but over the code-unit cap', () => {
    // 200 non-BMP characters: 200 code points, but 400 UTF-16 code units.
    const block = buildToolResultBlock({ tool_use_id: '😀'.repeat(200) })

    expect(toolResultBlockSchema.safeParse(block).success).toBe(false)
  })
})
