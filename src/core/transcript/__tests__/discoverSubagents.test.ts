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

  describe('workflow runs', () => {
    it('tags agents inside a workflow run with the run id', async () => {
      tree = await buildDiscoveryTree({
        files: {
          'session/subagents/agent-top.jsonl': '{}\n',
          'session/subagents/workflows/wf_a/agent-x.jsonl': '{}\n',
          'session/subagents/workflows/wf_a/agent-x.meta.json': '{"agentType":"t"}',
          'session/subagents/workflows/wf_a/journal.jsonl': '{}\n'
        }
      })

      const entries = await discoverSubagents(join(tree.root, 'session'))

      expect(entries.map((e) => [e.agentId, e.workflowRunId, e.metaPath !== null])).toEqual([
        ['top', null, false],
        ['x', 'wf_a', true]
      ])
    })

    it('gives the paths of a run agent inside its run folder', async () => {
      tree = await buildDiscoveryTree({
        files: {
          'session/subagents/workflows/wf_a/agent-x.jsonl': '{}\n',
          'session/subagents/workflows/wf_a/agent-x.meta.json': '{}'
        }
      })
      const runDir = join(tree.root, 'session', 'subagents', 'workflows', 'wf_a')

      const [entry] = await discoverSubagents(join(tree.root, 'session'))

      expect([entry?.transcript.path, entry?.metaPath]).toEqual([
        join(runDir, 'agent-x.jsonl'),
        join(runDir, 'agent-x.meta.json')
      ])
    })

    it('ignores a run folder whose name is not a valid run id', async () => {
      tree = await buildDiscoveryTree({
        files: {
          'session/subagents/workflows/not-a-run/agent-x.jsonl': '{}\n',
          'session/subagents/workflows/wf_a.b/agent-y.jsonl': '{}\n'
        }
      })

      expect(await discoverSubagents(join(tree.root, 'session'))).toEqual([])
    })

    it('ignores a symlinked run folder', async () => {
      tree = await buildDiscoveryTree({
        files: { 'elsewhere/agent-x.jsonl': '{}\n' },
        symlinks: { 'session/subagents/workflows/wf_a': '../../../elsewhere' }
      })

      expect(await discoverSubagents(join(tree.root, 'session'))).toEqual([])
    })

    it('ignores a file named like a run', async () => {
      tree = await buildDiscoveryTree({
        files: { 'session/subagents/workflows/wf_b': 'not a folder' }
      })

      expect(await discoverSubagents(join(tree.root, 'session'))).toEqual([])
    })

    it('ignores a folder nested inside a run folder', async () => {
      tree = await buildDiscoveryTree({
        files: {
          'session/subagents/workflows/wf_a/agent-x.jsonl': '{}\n',
          'session/subagents/workflows/wf_a/nested/agent-y.jsonl': '{}\n'
        }
      })

      const entries = await discoverSubagents(join(tree.root, 'session'))

      expect(entries.map((e) => e.agentId)).toEqual(['x'])
    })

    it('sorts top-level and run agents together by agent id', async () => {
      tree = await buildDiscoveryTree({
        files: {
          'session/subagents/agent-c.jsonl': '{}\n',
          'session/subagents/agent-a.jsonl': '{}\n',
          'session/subagents/workflows/wf_z/agent-b.jsonl': '{}\n',
          'session/subagents/workflows/wf_a/agent-d.jsonl': '{}\n'
        }
      })

      const entries = await discoverSubagents(join(tree.root, 'session'))

      expect(entries.map((e) => e.agentId)).toEqual(['a', 'b', 'c', 'd'])
    })

    it('sorts run agents by agent id whatever order the folders list in', async () => {
      tree = await buildDiscoveryTree({
        files: {
          'session/subagents/workflows/wf_a/agent-Zed.jsonl': '{}\n',
          'session/subagents/workflows/wf_a/agent-alpha.jsonl': '{}\n',
          'session/subagents/workflows/wf_b/agent-Beta.jsonl': '{}\n'
        }
      })
      reversedReaddirState.reverseListingFor = join(tree.root, 'session', 'subagents', 'workflows')

      const entries = await discoverSubagents(join(tree.root, 'session'))

      expect(entries.map((e) => e.agentId)).toEqual(['Beta', 'Zed', 'alpha'])
    })

    it('keeps only the top-level entry when an agent id also appears in a run', async () => {
      tree = await buildDiscoveryTree({
        files: {
          'session/subagents/agent-x.jsonl': '{}\n',
          'session/subagents/workflows/wf_a/agent-x.jsonl': '{}\n'
        }
      })

      const entries = await discoverSubagents(join(tree.root, 'session'))

      expect(entries.map((e) => [e.agentId, e.workflowRunId])).toEqual([['x', null]])
    })

    it('keeps the first run in id order when an agent id appears in two runs', async () => {
      tree = await buildDiscoveryTree({
        files: {
          'session/subagents/workflows/wf_b/agent-x.jsonl': '{}\n',
          'session/subagents/workflows/wf_a/agent-x.jsonl': '{}\n'
        }
      })
      reversedReaddirState.reverseListingFor = join(tree.root, 'session', 'subagents', 'workflows')

      const entries = await discoverSubagents(join(tree.root, 'session'))

      expect(entries.map((e) => [e.agentId, e.workflowRunId])).toEqual([['x', 'wf_a']])
    })

    it('returns the top-level agents when workflows is a file', async () => {
      tree = await buildDiscoveryTree({
        files: {
          'session/subagents/agent-top.jsonl': '{}\n',
          'session/subagents/workflows': 'not a folder'
        }
      })

      const entries = await discoverSubagents(join(tree.root, 'session'))

      expect(entries.map((e) => e.agentId)).toEqual(['top'])
    })

    it('returns the top-level agents when workflows is a symlink to a folder', async () => {
      tree = await buildDiscoveryTree({
        files: {
          'session/subagents/agent-top.jsonl': '{}\n',
          'elsewhere/wf_a/agent-x.jsonl': '{}\n'
        },
        symlinks: { 'session/subagents/workflows': '../../elsewhere' }
      })

      const entries = await discoverSubagents(join(tree.root, 'session'))

      expect(entries.map((e) => e.agentId)).toEqual(['top'])
    })

    it('finds run agents when the session has no top-level agents', async () => {
      tree = await buildDiscoveryTree({
        files: { 'session/subagents/workflows/wf_a/agent-x.jsonl': '{}\n' }
      })

      const entries = await discoverSubagents(join(tree.root, 'session'))

      expect(entries.map((e) => [e.agentId, e.workflowRunId])).toEqual([['x', 'wf_a']])
    })
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
