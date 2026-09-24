import { describe, expect, it } from 'vitest'
import {
  MAX_PROJECT_DIR_NAME_LENGTH,
  getSessionRequestSchema,
  listSessionsRequestSchema
} from '../requestSchemas'

const SESSION_ID = '1a1a1a1a-1111-4111-8111-11111111111b'

describe('listSessionsRequestSchema', () => {
  it('accepts a normal folder name', () => {
    expect(listSessionsRequestSchema.safeParse({ projectDirName: '-Users-me-proj' }).success).toBe(
      true
    )
  })

  it.each([
    ['dot-dot', '..'],
    ['dot', '.'],
    ['forward slash', 'a/b'],
    ['backslash', 'a\\b'],
    ['NUL', 'a\0b'],
    ['empty', ''],
    ['overlong', 'a'.repeat(MAX_PROJECT_DIR_NAME_LENGTH + 1)]
  ])('rejects a name with %s', (_label, projectDirName) => {
    expect(listSessionsRequestSchema.safeParse({ projectDirName }).success).toBe(false)
  })

  it('accepts a name at the length limit', () => {
    const projectDirName = 'a'.repeat(MAX_PROJECT_DIR_NAME_LENGTH)
    expect(listSessionsRequestSchema.safeParse({ projectDirName }).success).toBe(true)
  })

  it.each([[undefined], [null], ['proj'], [{}], [{ projectDirName: 5 }]])(
    'rejects the payload %j',
    (payload) => {
      expect(listSessionsRequestSchema.safeParse(payload).success).toBe(false)
    }
  )

  it('rejects unknown extra fields', () => {
    const payload = { projectDirName: 'proj', path: '/etc' }
    expect(listSessionsRequestSchema.safeParse(payload).success).toBe(false)
  })
})

describe('getSessionRequestSchema', () => {
  it('accepts a lowercase UUID session id', () => {
    const parsed = getSessionRequestSchema.safeParse({
      projectDirName: 'proj',
      sessionId: SESSION_ID
    })
    expect(parsed.success).toBe(true)
  })

  it.each([
    ['uppercase', SESSION_ID.toUpperCase()],
    ['not a UUID', 'not-a-uuid'],
    ['a path', '../secret'],
    ['a UUID with a suffix', `${SESSION_ID}.jsonl`],
    ['empty', '']
  ])('rejects a session id that is %s', (_label, sessionId) => {
    expect(getSessionRequestSchema.safeParse({ projectDirName: 'proj', sessionId }).success).toBe(
      false
    )
  })

  it('rejects a bad project name', () => {
    const parsed = getSessionRequestSchema.safeParse({
      projectDirName: '..',
      sessionId: SESSION_ID
    })
    expect(parsed.success).toBe(false)
  })
})
