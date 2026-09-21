import { describe, expect, it } from 'vitest'
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
})
