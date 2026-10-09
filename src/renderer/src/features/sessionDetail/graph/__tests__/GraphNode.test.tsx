import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { AgentGraphNode } from '../agentGraphNode'
import { GraphNode } from '../GraphNode'
import { testGraphNode } from '../testGraphNode'

const renderNode = (overrides: Partial<AgentGraphNode>, loading = false): void => {
  render(
    <GraphNode
      node={testGraphNode('lead', { name: 'Lead', ...overrides })}
      x={0}
      y={0}
      selected={false}
      loading={loading}
      parentName={null}
      onKeyDown={() => undefined}
    />
  )
}

describe('GraphNode marks', () => {
  it('shows the tool error count and no compaction mark when there are no compactions', () => {
    renderNode({ marks: { toolErrors: 12, compactions: 0 } })

    expect(screen.getByText('×12')).toBeTruthy()
    expect(screen.queryByText(/▲/)).toBeNull()
  })

  it('shows the compaction count and no tool error mark when there are no errors', () => {
    renderNode({ marks: { toolErrors: 0, compactions: 2 } })

    expect(screen.getByText('▲2')).toBeTruthy()
    expect(screen.queryByText(/×/)).toBeNull()
  })

  it('shows no marks for a node with none', () => {
    renderNode({ marks: null })

    expect(screen.queryByText(/[×▲]/)).toBeNull()
  })

  it('shows the marks before the stopped flag', () => {
    renderNode({ marks: { toolErrors: 3, compactions: 0 }, stopped: true })

    expect(screen.getByText('×3').compareDocumentPosition(screen.getByText('■ stopped'))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )
  })

  it('shows only the loading flag while the node loads', () => {
    renderNode({ marks: { toolErrors: 3, compactions: 1 }, stopped: true }, true)

    expect(screen.getByText('loading…')).toBeTruthy()
    expect(screen.queryByText('×3')).toBeNull()
    expect(screen.queryByText('▲1')).toBeNull()
    expect(screen.queryByText('■ stopped')).toBeNull()
  })
})
