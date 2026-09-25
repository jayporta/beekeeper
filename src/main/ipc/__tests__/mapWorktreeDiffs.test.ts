import { describe, expect, it } from 'vitest'
import { toAgentId } from '../../../core/transcript/ids'
import { err, ok } from '../../../core/transcript/result'
import type { AgentWorktreeDiff } from '../../git/sessionWorktreeDiffs'
import { mapWorktreeDiffs } from '../mapWorktreeDiffs'

const FORGED = 'must not cross the bridge'

describe('mapWorktreeDiffs', () => {
  it('copies only whitelisted fields of a successful diff', () => {
    const stat = {
      uncommitted: 'included',
      files: [{ path: 'a.ts', oldPath: 'b.ts', added: 1, deleted: null, extra: FORGED }],
      untracked: ['loose.txt'],
      extra: FORGED
    } as const
    const agent: AgentWorktreeDiff = {
      agentId: toAgentId('a'),
      inferredBase: true,
      result: ok(stat)
    }

    const dto = mapWorktreeDiffs({ git: 'ok', agents: [agent] })

    expect(dto).toEqual({
      git: 'ok',
      agents: [
        {
          agentId: 'a',
          inferredBase: true,
          result: {
            ok: true,
            diff: {
              uncommitted: 'included',
              files: [{ path: 'a.ts', oldPath: 'b.ts', added: 1, deleted: null }],
              untracked: ['loose.txt']
            }
          }
        }
      ]
    })
    expect(JSON.stringify(dto)).not.toContain(FORGED)
  })

  it('omits oldPath when the entry has none', () => {
    const agent: AgentWorktreeDiff = {
      agentId: toAgentId('a'),
      inferredBase: false,
      result: ok({
        uncommitted: 'no-worktree',
        files: [{ path: 'a.ts', added: 2, deleted: 0 }],
        untracked: []
      })
    }
    const [mapped] = mapWorktreeDiffs({ git: 'ok', agents: [agent] }).agents
    const files = mapped?.result.ok === true ? mapped.result.diff.files : []
    expect(files[0]).not.toHaveProperty('oldPath')
  })

  it('carries a failure as its code only', () => {
    const agent: AgentWorktreeDiff = {
      agentId: toAgentId('a'),
      inferredBase: false,
      result: err('outside-project')
    }
    expect(mapWorktreeDiffs({ git: 'ok', agents: [agent] }).agents[0]?.result).toEqual({
      ok: false,
      code: 'outside-project'
    })
  })
})
