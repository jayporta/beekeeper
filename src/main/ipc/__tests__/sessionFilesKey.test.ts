import { describe, expect, it } from 'vitest'
import { err, ok } from '../../../core/shared/result'
import type { SessionEntry } from '../../../core/transcript/discoverSessions'
import type { SubagentEntry } from '../../../core/transcript/discoverSubagents'
import { toAgentId, toSessionId } from '../../../core/transcript/ids'
import { sessionFilesKey } from '../sessionFilesKey'

const transcript = { path: '/lead.jsonl', mtimeMs: 10, size: 100 }

function subagent(overrides: Partial<SubagentEntry['transcript']> = {}): SubagentEntry {
  return {
    agentId: toAgentId('a1'),
    transcript: { path: '/a1.jsonl', mtimeMs: 20, size: 200, ...overrides },
    metaPath: null,
    workflowRunId: null
  }
}

function session(subagents: SessionEntry['subagents']): SessionEntry {
  return {
    sessionId: toSessionId('1a1a1a1a-1111-4111-8111-11111111111b'),
    sessionDir: '/dir',
    transcript: ok(transcript),
    subagents
  }
}

const keyOf = (entry: SessionEntry, file = transcript, projectDirName = '-p'): string =>
  sessionFilesKey({ projectDirName, session: entry, transcript: file })

describe('sessionFilesKey', () => {
  it('is the same for the same files', () => {
    expect(keyOf(session(ok([subagent()])))).toBe(keyOf(session(ok([subagent()]))))
  })

  it.each([
    ['the lead transcript’s mtime', () => keyOf(session(ok([])), { ...transcript, mtimeMs: 11 })],
    ['the lead transcript’s size', () => keyOf(session(ok([])), { ...transcript, size: 101 })],
    ['the project folder', () => keyOf(session(ok([])), transcript, '-q')],
    ['a subagent’s mtime', () => keyOf(session(ok([subagent({ mtimeMs: 21 })])))],
    ['a subagent’s size', () => keyOf(session(ok([subagent({ size: 201 })])))],
    ['a subagent appearing', () => keyOf(session(ok([subagent(), subagent()])))],
    [
      'a subagent’s meta file appearing',
      () => keyOf(session(ok([{ ...subagent(), metaPath: '/a1.meta.json' }])))
    ],
    [
      'a subagent’s workflow run',
      () =>
        keyOf(
          session(
            ok([
              { ...subagent(), workflowRunId: 'wf_1' as unknown as SubagentEntry['workflowRunId'] }
            ])
          )
        )
    ],
    [
      'the subagents becoming unlisted',
      () => keyOf(session(err({ reason: 'unreadable' as const, code: 'EACCES' })))
    ]
  ])('changes with %s', (_label, changed) => {
    expect(changed()).not.toBe(keyOf(session(ok([subagent()]))))
  })

  it('tells unlisted subagents from an empty list', () => {
    const unlisted = session(err({ reason: 'unreadable' as const, code: 'EACCES' }))

    expect(keyOf(unlisted)).not.toBe(keyOf(session(ok([]))))
  })
})
