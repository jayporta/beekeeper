import { describe, expect, it } from 'vitest'
import { writeToolUseResultSchema } from '../schemas/writeToolUseResult'
import { buildWriteToolUseResult } from '../testFileTouchFixtures'

describe('writeToolUseResultSchema', () => {
  it('accepts a well-formed Write result', () => {
    expect(writeToolUseResultSchema.safeParse(buildWriteToolUseResult()).success).toBe(true)
  })

  it('accepts an unknown key but strips it from the parsed data', () => {
    const result = { ...buildWriteToolUseResult(), memdirStamped: true }

    const parsed = writeToolUseResultSchema.safeParse(result)

    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.data).not.toHaveProperty('memdirStamped')
  })

  it('rejects a result missing the required filePath', () => {
    expect(writeToolUseResultSchema.safeParse({ type: 'create' }).success).toBe(false)
  })

  it('rejects a type outside create/update', () => {
    const result = buildWriteToolUseResult('/repo/file.ts', 'create')
    expect(writeToolUseResultSchema.safeParse({ ...result, type: 'delete' }).success).toBe(false)
  })
})
