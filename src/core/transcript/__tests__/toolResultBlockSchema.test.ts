import { describe, expect, it } from 'vitest'
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
})
