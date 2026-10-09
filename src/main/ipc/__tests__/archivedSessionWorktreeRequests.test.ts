import { describe, expect, it } from 'vitest'
import { testDetail } from '../../archive/testArchiveFixtures'
import { createFakeArchive } from '../../archive/testFakeArchive'
import { getWorktreeDiffsHandler } from '../getWorktreeDiffsHandler'
import { getWorktreePatchHandler } from '../getWorktreePatchHandler'
import { sessionRefKey } from '../sessionRefKey'
import { TEST_PROJECT, registerIpcTestTree } from '../testIpcTree'

const ctx = registerIpcTestTree()
const GONE = { projectDirName: TEST_PROJECT, sessionId: '9f9f9f9f-9999-4999-8999-99999999999a' }

function archiveHoldingGone(): ReturnType<typeof createFakeArchive> {
  return createFakeArchive(undefined, {
    details: new Map([[sessionRefKey(GONE), { ...testDetail(), sessionId: GONE.sessionId }]])
  })
}

describe('worktree requests for an archived session', () => {
  it('answers not-found for its diffs', async () => {
    const result = await getWorktreeDiffsHandler(
      { ...ctx.deps, archive: archiveHoldingGone() },
      GONE
    )

    expect(result).toEqual({ ok: false, error: { code: 'not-found' } })
  })

  it('answers not-found for its patch', async () => {
    const result = await getWorktreePatchHandler(
      { ...ctx.deps, archive: archiveHoldingGone() },
      { ...GONE, agentId: 'a1' }
    )

    expect(result).toEqual({ ok: false, error: { code: 'not-found' } })
  })
})
