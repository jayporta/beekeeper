import { describe, expect, it } from 'vitest'
import { findRequestedSession, lookupRequestedSession } from '../findRequestedSession'
import { TEST_PROJECT, TEST_SESSION_ID, registerIpcTestTree } from '../testIpcTree'

const ctx = registerIpcTestTree()
const MISSING_ID = '9f9f9f9f-9999-4999-8999-99999999999a'

describe('lookupRequestedSession', () => {
  it('finds a session in a listed project', async () => {
    const lookup = await lookupRequestedSession(ctx.deps, {
      projectDirName: TEST_PROJECT,
      sessionId: TEST_SESSION_ID
    })

    expect(lookup).toMatchObject({
      kind: 'found',
      session: { projectDirName: TEST_PROJECT, sessionId: TEST_SESSION_ID }
    })
  })

  it('reports a session missing from a project that is listed, with the request', async () => {
    const lookup = await lookupRequestedSession(ctx.deps, {
      projectDirName: TEST_PROJECT,
      sessionId: MISSING_ID
    })

    expect(lookup).toEqual({
      kind: 'session-missing',
      ref: { projectDirName: TEST_PROJECT, sessionId: MISSING_ID }
    })
  })

  it('reports not-found, not a missing session, for a project that is not listed', async () => {
    const lookup = await lookupRequestedSession(ctx.deps, {
      projectDirName: '-no-such-project',
      sessionId: TEST_SESSION_ID
    })

    expect(lookup).toEqual({ kind: 'error', code: 'not-found' })
  })

  it('reports invalid-request for a bad payload', async () => {
    const lookup = await lookupRequestedSession(ctx.deps, { projectDirName: TEST_PROJECT })

    expect(lookup).toEqual({ kind: 'error', code: 'invalid-request' })
  })
})

describe('findRequestedSession', () => {
  it('answers not-found for a session missing from a listed project', async () => {
    const result = await findRequestedSession(ctx.deps, {
      projectDirName: TEST_PROJECT,
      sessionId: MISSING_ID
    })

    expect(result).toEqual({ ok: false, error: { code: 'not-found' } })
  })

  it('answers with the session it found', async () => {
    const result = await findRequestedSession(ctx.deps, {
      projectDirName: TEST_PROJECT,
      sessionId: TEST_SESSION_ID
    })

    expect(result.ok && result.value.sessionId).toBe(TEST_SESSION_ID)
  })
})
