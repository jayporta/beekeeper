import { describe, expect, it } from 'vitest'
import { editToolUseResultSchema } from '../schemas/editToolUseResult'
import { buildEditToolUseResult } from '../testFileTouchFixtures'

describe('editToolUseResultSchema', () => {
  it('accepts a well-formed Edit result', () => {
    expect(editToolUseResultSchema.safeParse(buildEditToolUseResult()).success).toBe(true)
  })

  it('accepts unknown extra fields such as memdirStamped', () => {
    const result = { ...buildEditToolUseResult(), memdirStamped: true, staleRecovered: false }

    expect(editToolUseResultSchema.safeParse(result).success).toBe(true)
  })

  it('rejects a result missing the required filePath', () => {
    expect(editToolUseResultSchema.safeParse({ oldString: 'a', newString: 'b' }).success).toBe(
      false
    )
  })
})
