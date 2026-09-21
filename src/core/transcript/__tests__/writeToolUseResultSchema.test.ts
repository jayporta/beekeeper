import { describe, expect, it } from 'vitest'
import { writeToolUseResultSchema } from '../schemas/writeToolUseResult'
import { buildWriteToolUseResult } from '../testFileTouchFixtures'

describe('writeToolUseResultSchema', () => {
  it('accepts a well-formed Write result', () => {
    expect(writeToolUseResultSchema.safeParse(buildWriteToolUseResult()).success).toBe(true)
  })

  it('accepts unknown extra fields (schema drift)', () => {
    const result = { ...buildWriteToolUseResult(), memdirStamped: true }

    expect(writeToolUseResultSchema.safeParse(result).success).toBe(true)
  })

  it('rejects a result missing the required filePath', () => {
    expect(writeToolUseResultSchema.safeParse({ type: 'create' }).success).toBe(false)
  })

  it('rejects a type outside create/update', () => {
    const result = buildWriteToolUseResult('/repo/file.ts', 'create')
    expect(writeToolUseResultSchema.safeParse({ ...result, type: 'delete' }).success).toBe(false)
  })
})
