import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  TEST_DIFF_FILE,
  buildBashResultRecord,
  buildEditResultRecord,
  buildHunk
} from '../../../core/session/fileDiff/testFileDiffFixtures'
import { buildAssistantToolUseRecord } from '../../../core/transcript/testFileTouchFixtures'
import { buildDiscoveryTree, type DiscoveryTree } from '../../../core/transcript/testDiscoveryTree'
import { buildJsonlText } from '../../../core/transcript/testFixtures'
import { createIpcDeps } from '../createIpcDeps'
import { getFileDiffHandler } from '../getFileDiffHandler'
import type { IpcDeps } from '../ipcDeps'
import { TEST_PROJECT, TEST_SESSION_ID } from '../testIpcTree'

const trees: DiscoveryTree[] = []
afterEach(async () => {
  await Promise.all(trees.splice(0).map((tree) => tree.cleanup()))
})

const sessionDir = `.claude/projects/${TEST_PROJECT}`
const leadFile = `${sessionDir}/${TEST_SESSION_ID}.jsonl`
const subFile = (id: string): string =>
  `${sessionDir}/${TEST_SESSION_ID}/subagents/agent-${id}.jsonl`
const request = {
  projectDirName: TEST_PROJECT,
  sessionId: TEST_SESSION_ID,
  agentId: null,
  filePath: TEST_DIFF_FILE
}

/** One Edit call and its recorded result, as two transcript records. */
function editCall(toolUseId: string, line: string): Record<string, unknown>[] {
  return [
    buildAssistantToolUseRecord({ toolUseId, messageId: `msg_${toolUseId}` }),
    buildEditResultRecord({
      toolUseId,
      structuredPatch: [buildHunk({ lines: [`+${line}`] })]
    })
  ]
}

/** One Bash call and its result. */
function bashCall(
  toolUseId: string,
  bashEditDiff: Record<string, unknown>
): Record<string, unknown>[] {
  return [
    buildAssistantToolUseRecord({ toolUseId, toolName: 'Bash', messageId: `msg_${toolUseId}` }),
    buildBashResultRecord({ toolUseId, bashEditDiff })
  ]
}

async function build(files: Record<string, readonly unknown[]>): Promise<IpcDeps> {
  const tree = await buildDiscoveryTree({
    files: Object.fromEntries(
      Object.entries(files).map(([path, records]) => [path, buildJsonlText(records)])
    )
  })
  trees.push(tree)
  return createIpcDeps(tree.root)
}

describe('getFileDiffHandler', () => {
  it('returns the lead edits to a file in order', async () => {
    const deps = await build({
      [leadFile]: [...editCall('t1', 'first'), ...editCall('t2', 'second')]
    })

    const result = await getFileDiffHandler(deps, request)

    expect(result).toMatchObject({
      ok: true,
      value: {
        filePath: TEST_DIFF_FILE,
        truncated: false,
        changes: [
          {
            kind: 'patch',
            source: 'edit-write',
            operation: 'edit',
            hunks: [{ lines: ['+first'] }]
          },
          { kind: 'patch', hunks: [{ lines: ['+second'] }] }
        ]
      }
    })
  })

  it('reads a subagent request from the subagent transcript', async () => {
    const deps = await build({
      [leadFile]: editCall('lead1', 'lead edit'),
      [subFile('a1')]: editCall('sub1', 'sub edit')
    })

    const result = await getFileDiffHandler(deps, { ...request, agentId: 'a1' })

    expect(result).toMatchObject({
      ok: true,
      value: { changes: [{ hunks: [{ lines: ['+sub edit'] }] }] }
    })
  })

  it('shows a fork only its own change, not the copy of the lead edit', async () => {
    const deps = await build({
      [leadFile]: editCall('lead1', 'lead edit'),
      [subFile('a1')]: [...editCall('lead1', 'lead edit'), ...editCall('sub1', 'fork edit')]
    })

    const fork = await getFileDiffHandler(deps, { ...request, agentId: 'a1' })
    const lead = await getFileDiffHandler(deps, request)

    expect(fork).toMatchObject({
      ok: true,
      value: { changes: [{ hunks: [{ lines: ['+fork edit'] }] }] }
    })
    expect(lead).toMatchObject({
      ok: true,
      value: { changes: [{ hunks: [{ lines: ['+lead edit'] }] }] }
    })
    expect(fork.ok && fork.value.changes).toHaveLength(1)
  })

  it('returns a Bash patch, and marks a file listed only in changedFiles unrecorded', async () => {
    const withHunks = await build({
      [leadFile]: bashCall('b1', { files: [{ filePath: TEST_DIFF_FILE, hunks: [buildHunk()] }] })
    })
    const listOnly = await build({
      [leadFile]: bashCall('b1', { changedFiles: [TEST_DIFF_FILE] })
    })

    expect(await getFileDiffHandler(withHunks, request)).toMatchObject({
      ok: true,
      value: { changes: [{ kind: 'patch', source: 'bash' }] }
    })
    expect(await getFileDiffHandler(listOnly, request)).toMatchObject({
      ok: true,
      value: { changes: [{ kind: 'unrecorded', source: 'bash' }] }
    })
  })

  it.each([
    ['an unknown file', { filePath: '/repo/other.ts' }],
    ['an unknown agent', { agentId: 'nope' }]
  ])('finds nothing for %s', async (_label, override) => {
    const deps = await build({ [leadFile]: editCall('t1', 'x') })

    expect(await getFileDiffHandler(deps, { ...request, ...override })).toEqual({
      ok: false,
      error: { code: 'not-found' }
    })
  })

  it.each([
    ['an extra key', { ...request, extra: 1 }],
    ['a path-like agent id', { ...request, agentId: '..' }],
    ['no payload', undefined]
  ])('refuses %s', async (_label, payload) => {
    const deps = await build({ [leadFile]: editCall('t1', 'x') })

    expect(await getFileDiffHandler(deps, payload)).toEqual({
      ok: false,
      error: { code: 'invalid-request' }
    })
  })

  it('returns an error result, not a throw, when the session transcript is gone', async () => {
    const deps = await build({ [leadFile]: editCall('t1', 'x') })

    const result = await getFileDiffHandler(deps, {
      ...request,
      sessionId: '2b2b2b2b-2222-4222-8222-22222222222b'
    })

    expect(result).toEqual({ ok: false, error: { code: 'not-found' } })
  })

  it('returns not-found when the transcript is removed after the scan', async () => {
    const tree = await buildDiscoveryTree({
      files: {
        [subFile('a1')]: buildJsonlText(editCall('sub1', 'x')),
        [leadFile]: buildJsonlText([])
      }
    })
    trees.push(tree)
    const base = createIpcDeps(tree.root)
    const deps: IpcDeps = {
      ...base,
      scans: {
        run: async (key, task) => {
          const scan = await base.scans.run(key, task)
          await rm(join(tree.root, subFile('a1')))
          return scan
        }
      }
    }

    expect(await getFileDiffHandler(deps, { ...request, agentId: 'a1' })).toEqual({
      ok: false,
      error: { code: 'not-found' }
    })
  })
})
