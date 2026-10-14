import { describe, expect, it } from 'vitest'
import { MAX_PATH_CODE_UNITS } from '../../../core/shared/boundedPath'
import { MAX_FILE_PATH_LENGTH, getFileDiffRequestSchema } from '../../../shared/ipc/requestSchemas'

const request = {
  projectDirName: '-Users-test-proj',
  sessionId: '1a1a1a1a-1111-4111-8111-11111111111b',
  agentId: null
}

describe('getFileDiffRequestSchema file path', () => {
  it('allows as long a path as a tool result can report', () => {
    expect(MAX_FILE_PATH_LENGTH).toBe(MAX_PATH_CODE_UNITS)
  })

  it('accepts an empty path, which a tool result may report', () => {
    expect(getFileDiffRequestSchema.safeParse({ ...request, filePath: '' }).success).toBe(true)
  })

  it('refuses a path over the cap', () => {
    const filePath = 'a'.repeat(MAX_FILE_PATH_LENGTH + 1)

    expect(getFileDiffRequestSchema.safeParse({ ...request, filePath }).success).toBe(false)
  })
})
