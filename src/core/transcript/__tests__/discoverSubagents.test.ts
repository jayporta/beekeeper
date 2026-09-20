import { isAbsolute, join, relative } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { discoverSubagents } from '../discoverSubagents'
import { buildDiscoveryTree, type DiscoveryTree } from '../testDiscoveryTree'
import type { ReversedReaddirState } from '../testReversedReaddir'

const reversedReaddirState = vi.hoisted<ReversedReaddirState>(() => ({
  reverseListingFor: undefined
}))

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  const { buildReversedReaddirModule } = await import('../testReversedReaddir')
  return buildReversedReaddirModule(actual, reversedReaddirState)
})

let tree: DiscoveryTree | undefined

afterEach(async () => {
  await tree?.cleanup()
  tree = undefined
  reversedReaddirState.reverseListingFor = undefined
})

describe('discoverSubagents', () => {
  it('returns no subagents when the session folder does not exist', async () => {
    tree = await buildDiscoveryTree({})

    expect(await discoverSubagents(join(tree.root, 'missing-session'))).toEqual([])
  })

  it('returns no subagents when the session folder has no subagents folder', async () => {
    tree = await buildDiscoveryTree({ files: { 'session/notes.txt': '' } })

    expect(await discoverSubagents(join(tree.root, 'session'))).toEqual([])
  })

  it('pairs subagent transcripts with meta files and ignores unrelated siblings', async () => {
    tree = await buildDiscoveryTree({
      files: {
        'session/subagents/agent-a.jsonl': 'a',
        'session/subagents/agent-a.meta.json': '{}',
        'session/subagents/agent-b.jsonl': 'b',
        'session/subagents/agent-orphan.meta.json': '{}',
        'session/subagents/agent-a.forked-skill.json': '{}',
        'session/subagents/agent-a.marker.json': '{}',
        'session/subagents/agent-atask8-review-abc123.jsonl': 'x',
        'session/subagents/agent-.jsonl': ''
      }
    })

    const subagents = await discoverSubagents(join(tree.root, 'session'))

    expect(subagents.map((s) => s.agentId)).toEqual(['a', 'atask8-review-abc123', 'b'])
    expect(subagents.find((s) => s.agentId === 'a')?.metaPath).toBe(
      join(tree.root, 'session', 'subagents', 'agent-a.meta.json')
    )
    expect(subagents.find((s) => s.agentId === 'b')?.metaPath).toBeNull()
  })

  it('skips a symlinked subagent transcript and a symlinked meta file', async () => {
    tree = await buildDiscoveryTree({
      files: {
        'session/subagents/agent-y.jsonl': 'y',
        'real-agent-x.jsonl': 'x',
        'real-agent-y-meta.json': '{}'
      },
      symlinks: {
        'session/subagents/agent-x.jsonl': '../../real-agent-x.jsonl',
        'session/subagents/agent-y.meta.json': '../../real-agent-y-meta.json'
      }
    })

    const subagents = await discoverSubagents(join(tree.root, 'session'))

    expect(subagents.map((s) => s.agentId)).toEqual(['y'])
    expect(subagents[0]?.metaPath).toBeNull()
  })

  it('returns subagents in code-unit order regardless of filesystem listing order', async () => {
    tree = await buildDiscoveryTree({
      files: {
        'session/subagents/agent-Zed.jsonl': '',
        'session/subagents/agent-alpha.jsonl': '',
        'session/subagents/agent-Beta.jsonl': ''
      }
    })
    reversedReaddirState.reverseListingFor = join(tree.root, 'session', 'subagents')

    const subagents = await discoverSubagents(join(tree.root, 'session'))

    expect(subagents.map((s) => s.agentId)).toEqual(['Beta', 'Zed', 'alpha'])
  })

  it('returns no subagents when subagents is a file, not a directory', async () => {
    tree = await buildDiscoveryTree({
      files: { 'session/subagents': 'not a directory' }
    })

    const subagents = await discoverSubagents(join(tree.root, 'session'))

    expect(subagents).toEqual([])
  })

  it('returns no subagents when subagents is a symlink to a directory', async () => {
    tree = await buildDiscoveryTree({
      files: { 'real-subagents/agent-x.jsonl': '' },
      symlinks: { 'session/subagents': '../real-subagents' }
    })

    const subagents = await discoverSubagents(join(tree.root, 'session'))

    expect(subagents).toEqual([])
  })

  it('returns no subagents when the session directory itself is a symlink', async () => {
    tree = await buildDiscoveryTree({
      files: { 'real-session-target/subagents/agent-x.jsonl': '' },
      symlinks: { session: 'real-session-target' }
    })

    const subagents = await discoverSubagents(join(tree.root, 'session'))

    expect(subagents).toEqual([])
  })

  it('resolves a relative sessionDir into absolute transcript and meta paths', async () => {
    tree = await buildDiscoveryTree({
      files: {
        'session/subagents/agent-a.jsonl': 'a',
        'session/subagents/agent-a.meta.json': '{}'
      }
    })
    const relativeSessionDir = relative(process.cwd(), join(tree.root, 'session'))

    const subagents = await discoverSubagents(relativeSessionDir)

    expect(subagents).toHaveLength(1)
    const [subagent] = subagents
    expect(subagent?.transcript.path).toBe(join(tree.root, 'session', 'subagents', 'agent-a.jsonl'))
    expect(isAbsolute(subagent?.transcript.path ?? '')).toBe(true)
    expect(subagent?.metaPath).toBe(join(tree.root, 'session', 'subagents', 'agent-a.meta.json'))
    expect(isAbsolute(subagent?.metaPath ?? '')).toBe(true)
  })
})
