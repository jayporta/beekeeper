import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { err, ok } from '../../../core/shared/result'
import { discoverSessions } from '../../../core/transcript/discoverSessions'
import { toSessionId } from '../../../core/transcript/ids'
import { buildDiscoveryTree, type DiscoveryTree } from '../../../core/transcript/testDiscoveryTree'
import { hasChangedSessions } from '../hasChangedSessions'
import type { SessionRefDto } from '../../../shared/ipc/sessionRefDto'
import type { SourceState } from '../createArchiveStore'

const PROJECT = '-work-app'
const FIRST = '1a1a1a1a-1111-4111-8111-11111111111b'
const SECOND = '2b2b2b2b-2222-4222-8222-22222222222c'

let tree: DiscoveryTree

beforeEach(async () => {
  tree = await buildDiscoveryTree({
    files: {
      [`${PROJECT}/${FIRST}.jsonl`]: '{"type":"user"}\n',
      [`${PROJECT}/${SECOND}.jsonl`]: '{"type":"user"}\n{"type":"user"}\n'
    }
  })
})

afterEach(async () => {
  await tree.cleanup()
})

/** A store whose archived items are exactly `known`, keyed by session id. */
function storeKnowing(known: ReadonlyMap<string, SourceState>): {
  hasListItem: (ref: SessionRefDto, source: SourceState) => boolean
} {
  return {
    hasListItem: (ref, source) => {
      const stored = known.get(ref.sessionId)
      return stored?.mtimeMs === source.mtimeMs && stored.size === source.size
    }
  }
}

async function stateOf(sessionId: string): Promise<SourceState> {
  const info = await stat(join(tree.root, PROJECT, `${sessionId}.jsonl`))
  return { mtimeMs: info.mtimeMs, size: info.size }
}

function check(store: ReturnType<typeof storeKnowing>): Promise<boolean> {
  return hasChangedSessions({
    projectDirName: PROJECT,
    projectPath: join(tree.root, PROJECT),
    store
  })
}

describe('hasChangedSessions', () => {
  it('is true when a session is not archived', async () => {
    const store = storeKnowing(new Map([[FIRST, await stateOf(FIRST)]]))

    expect(await check(store)).toBe(true)
  })

  it('is false when every session is archived at its current state', async () => {
    const store = storeKnowing(
      new Map([
        [FIRST, await stateOf(FIRST)],
        [SECOND, await stateOf(SECOND)]
      ])
    )

    expect(await check(store)).toBe(false)
  })

  it('is true when an archived session has since changed', async () => {
    const store = storeKnowing(
      new Map([
        [FIRST, await stateOf(FIRST)],
        [SECOND, { ...(await stateOf(SECOND)), size: 1 }]
      ])
    )

    expect(await check(store)).toBe(true)
  })

  it('is false for a project folder with no sessions', async () => {
    const result = await hasChangedSessions({
      projectDirName: 'no-such-project',
      projectPath: join(tree.root, 'no-such-project'),
      store: storeKnowing(new Map())
    })

    expect(result).toBe(false)
  })

  it('ignores a session whose transcript cannot be stat-ed', async () => {
    const unreadable: Awaited<ReturnType<typeof discoverSessions>> = [
      {
        sessionId: toSessionId(FIRST),
        sessionDir: join(tree.root, PROJECT, FIRST),
        transcript: err({ reason: 'unreadable', code: 'EIO' }),
        subagents: ok([])
      }
    ]

    const result = await hasChangedSessions({
      projectDirName: PROJECT,
      projectPath: join(tree.root, PROJECT),
      store: storeKnowing(new Map()),
      discover: () => Promise.resolve(unreadable)
    })

    expect(result).toBe(false)
  })

  it('asks the store about the session in the requested project', async () => {
    const asked: SessionRefDto[] = []

    await hasChangedSessions({
      projectDirName: PROJECT,
      projectPath: join(tree.root, PROJECT),
      store: {
        hasListItem: (ref) => {
          asked.push(ref)
          return true
        }
      }
    })

    expect(asked).toEqual([
      { projectDirName: PROJECT, sessionId: FIRST },
      { projectDirName: PROJECT, sessionId: SECOND }
    ])
  })
})
