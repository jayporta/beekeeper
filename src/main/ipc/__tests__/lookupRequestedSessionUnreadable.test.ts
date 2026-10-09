import { describe, expect, it, vi } from 'vitest'
import { err, ok } from '../../../core/shared/result'
import { toSessionId } from '../../../core/transcript/ids'
import { testDetail } from '../../archive/testArchiveFixtures'
import { createFakeArchive } from '../../archive/testFakeArchive'
import { getSessionHandler } from '../getSessionHandler'
import { lookupRequestedSession } from '../findRequestedSession'
import { sessionRefKey } from '../sessionRefKey'
import { TEST_PROJECT, TEST_SESSION_ID, registerIpcTestTree } from '../testIpcTree'

vi.mock('../../../core/transcript/discoverSessions', () => ({
  discoverSessions: () =>
    Promise.resolve([
      {
        sessionId: toSessionId('1a1a1a1a-1111-4111-8111-11111111111b'),
        sessionDir: '/nowhere',
        transcript: err({ reason: 'unreadable', code: 'EACCES' }),
        subagents: ok([])
      }
    ])
}))

const ctx = registerIpcTestTree()
const request = { projectDirName: TEST_PROJECT, sessionId: TEST_SESSION_ID }

describe('a listed session whose transcript cannot be read', () => {
  it('is reported as an error with the code, not as a missing session', async () => {
    const lookup = await lookupRequestedSession(ctx.deps, request)

    expect(lookup).toEqual({ kind: 'error', code: 'unreadable' })
  })

  it('never falls back to the archived detail', async () => {
    const archive = createFakeArchive(undefined, {
      details: new Map([[sessionRefKey(request), { ...testDetail(), sessionId: TEST_SESSION_ID }]])
    })

    const result = await getSessionHandler({ ...ctx.deps, archive }, request)

    expect(result).toEqual({ ok: false, error: { code: 'unreadable' } })
  })
})
