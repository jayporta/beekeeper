import { describe, expect, it } from 'vitest'
import type { AgentTreeNode } from '../../../core/session/agentTree'
import { mapAgentNode } from '../mapAgentTree'

function nodeWith(metaStatus: unknown): AgentTreeNode {
  return {
    identity: { kind: 'lead' },
    metaStatus,
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

describe('mapAgentNode workflow fields', () => {
  it('maps the run id of a workflow agent and null for the lead', () => {
    const node = {
      identity: { kind: 'subagent', agentId: 'w1' },
      metaStatus: { status: 'absent' },
      workflowRunId: 'wf_a',
      children: [
        {
          identity: { kind: 'subagent', agentId: 'w2' },
          metaStatus: { status: 'absent' },
          workflowRunId: null,
          children: []
        }
      ]
    } as unknown as AgentTreeNode

    const dto = mapAgentNode(node)

    expect([dto.workflowRunId, dto.children[0]?.workflowRunId]).toEqual(['wf_a', null])
  })

  it('maps the workflow phase from the meta', () => {
    const dto = mapAgentNode(
      nodeWith({ status: 'ok', meta: { agentType: 'scout', workflowPhase: 'Inventory' } })
    )

    expect(dto.meta).toMatchObject({ status: 'ok', meta: { workflowPhase: 'Inventory' } })
  })
})
