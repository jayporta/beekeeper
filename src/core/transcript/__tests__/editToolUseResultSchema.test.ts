import { describe, expect, it } from 'vitest'
import { editToolUseResultSchema } from '../schemas/editToolUseResult'
import { buildEditToolUseResult } from '../testFileTouchFixtures'

describe('editToolUseResultSchema', () => {
  it('accepts a well-formed Edit result', () => {
    expect(editToolUseResultSchema.safeParse(buildEditToolUseResult()).success).toBe(true)
  })

  it('accepts an unknown key but strips it from the parsed data', () => {
    const result = { ...buildEditToolUseResult(), memdirStamped: true, staleRecovered: false }

    const parsed = editToolUseResultSchema.safeParse(result)

    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.data).not.toHaveProperty('memdirStamped')
  })

  it('rejects a result missing the required filePath', () => {
    expect(editToolUseResultSchema.safeParse({ oldString: 'a', newString: 'b' }).success).toBe(
      false
    )
  })
})
