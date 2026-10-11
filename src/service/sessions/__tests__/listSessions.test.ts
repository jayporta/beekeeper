import { describe, expect, it } from 'vitest'
import { TEST_PROJECT, TEST_SESSION_ID, registerServiceTestTree } from '../../testServiceTree'
import { listSessions } from '../listSessions'

const ctx = registerServiceTestTree()

const notFound = { ok: false, error: { code: 'not-found' } }

describe('listSessions', () => {
  it('lists a session with its summary and subagent count', async () => {
    const result = await listSessions(ctx.deps, { projectDirName: TEST_PROJECT })
    expect(result).toMatchObject({
      ok: true,
      value: [
        {
          sessionId: TEST_SESSION_ID,
          subagentCount: 1,
          summary: { ok: true, value: { title: 'My title', usage: null } }
        }
      ]
    })
  })

  it('returns not-found for an unknown project', async () => {
    expect(await listSessions(ctx.deps, { projectDirName: 'other' })).toEqual(notFound)
  })

  it('reports an unreadable summary as a code when the transcript vanishes after listing', async () => {
    const cache = {
      read: () =>
        Promise.resolve({
          ok: false as const,
          error: { reason: 'unreadable' as const, code: 'ENOENT' }
        })
    }
    const result = await listSessions(
      { ...ctx.deps, summaryCache: cache },
      { projectDirName: TEST_PROJECT }
    )
    expect(result).toMatchObject({
      ok: true,
      value: [{ summary: { ok: false, error: { code: 'not-found' } } }]
    })
  })
})
