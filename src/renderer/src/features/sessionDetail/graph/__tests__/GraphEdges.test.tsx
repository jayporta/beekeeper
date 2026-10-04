import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { AgentKey } from '../agentGraphNode'
import { GraphEdges } from '../GraphEdges'
import type { GraphEdge } from '../layoutGraph'

/** An edge whose path counts how often it is read, which a render of the edges does once per edge. */
function countedEdge(to: string, reads: { count: number }): GraphEdge {
  return {
    from: 'lead',
    to: to as AgentKey,
    get path() {
      reads.count += 1
      return 'M0 0 L10 10'
    }
  }
}

describe('GraphEdges', () => {
  it('draws one path per edge, in a hidden svg of the graph’s size', () => {
    const edges = [countedEdge('sub:a', { count: 0 }), countedEdge('sub:b', { count: 0 })]

    const { container } = render(<GraphEdges edges={edges} width={300} height={200} />)

    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
    expect([svg?.getAttribute('width'), svg?.getAttribute('height')]).toEqual(['300', '200'])
    expect(container.querySelectorAll('path')).toHaveLength(2)
  })

  it('draws nothing again when rendered with the same edges', () => {
    const reads = { count: 0 }
    const edges = [countedEdge('sub:a', reads)]
    const { rerender } = render(<GraphEdges edges={edges} width={300} height={200} />)
    const afterFirst = reads.count

    rerender(<GraphEdges edges={edges} width={300} height={200} />)

    expect(reads.count).toBe(afterFirst)
  })

  it('draws again when the edges change', () => {
    const reads = { count: 0 }
    const { rerender } = render(
      <GraphEdges edges={[countedEdge('sub:a', reads)]} width={300} height={200} />
    )
    const afterFirst = reads.count

    rerender(<GraphEdges edges={[countedEdge('sub:a', reads)]} width={300} height={200} />)

    expect(reads.count).toBeGreaterThan(afterFirst)
  })
})
