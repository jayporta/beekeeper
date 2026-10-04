import { describe, expect, it } from 'vitest'
import { discoverProjects } from '../../../core/transcript/discoverProjects'
import { createSessionSummaryCache } from '../../../core/transcript/summary/sessionSummaryCache'
import { AGENT_SESSION_ID, scoutRecords, writeTranscript } from '../testFamilyFixtures'
import { scanProjectSessions } from '../scanProjectSessions'
import { TEST_PROJECT, TEST_SESSION_ID, registerIpcTestTree } from '../testIpcTree'

const ctx = registerIpcTestTree()

async function scan(
  keep?: (sessionId: string) => boolean
): Promise<{ ids: string[]; reads: string[] }> {
  await writeTranscript(ctx.tree.home, {
    projectDirName: TEST_PROJECT,
    sessionId: AGENT_SESSION_ID,
    records: scoutRecords()
  })
  const [project] = (await discoverProjects(ctx.deps.projectsRoot)).filter(
    (entry) => entry.dirName === TEST_PROJECT
  )
  if (project === undefined) throw new Error('no test project')
  const reads: string[] = []
  const inner = createSessionSummaryCache()
  const deps = {
    ...ctx.deps,
    summaryCache: {
      read: (file: Parameters<typeof inner.read>[0]) => {
        reads.push(file.path)
        return inner.read(file)
      }
    }
  }
  const scanned = await scanProjectSessions(
    keep === undefined ? { project } : { project, keep: (entry) => keep(entry.sessionId) },
    deps
  )
  return { ids: scanned.map((session) => session.entry.sessionId).sort(), reads }
}

describe('scanProjectSessions', () => {
  it('reads every session when nothing is refused', async () => {
    const { ids, reads } = await scan()

    expect(ids).toEqual([AGENT_SESSION_ID, TEST_SESSION_ID].sort())
    expect(reads).toHaveLength(2)
  })

  it('leaves out a session `keep` refuses, without reading it', async () => {
    const { ids, reads } = await scan((id) => id !== AGENT_SESSION_ID)

    expect(ids).toEqual([TEST_SESSION_ID])
    expect(reads).toHaveLength(1)
    expect(reads[0]).toContain(TEST_SESSION_ID)
  })

  it('reads nothing when `keep` refuses every session', async () => {
    const { ids, reads } = await scan(() => false)

    expect(ids).toEqual([])
    expect(reads).toEqual([])
  })
})
