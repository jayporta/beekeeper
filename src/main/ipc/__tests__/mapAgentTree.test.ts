import { describe, expect, it } from 'vitest'
import type { AgentTreeNode } from '../../../core/session/agentTree'
import { mapAgentNode } from '../mapAgentTree'

function nodeWith(metaStatus: unknown): AgentTreeNode {
  return {
    identity: { kind: 'lead' },
    metaStatus,
    isTeammate: false,
    children: []
  } as unknown as AgentTreeNode
}

describe('mapAgentNode meta status', () => {
  it('drops a field a core error status gains later', () => {
    const dto = mapAgentNode(nodeWith({ status: 'error', reason: 'malformed', extra: 'leak' }))
    expect(dto.meta).toEqual({ status: 'error', reason: 'malformed' })
  })

  it('drops a field a core absent status gains later', () => {
    const dto = mapAgentNode(nodeWith({ status: 'absent', extra: 'leak' }))
    expect(dto.meta).toEqual({ status: 'absent' })
  })
})
