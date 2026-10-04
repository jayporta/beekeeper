import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { InspectorTotals } from '../InspectorTotals'

const cost = { usd: 1, partial: false }
const noBelow = { tokens: 0, below: 0, incomplete: false }

describe('InspectorTotals with the agent’s own tokens not recorded', () => {
  it('says the tokens were not recorded instead of showing a figure', () => {
    render(<InspectorTotals tokens={null} cost={cost} rollup={noBelow} unreadableLines={false} />)

    expect(screen.getByText('tokens not recorded')).toBeTruthy()
    expect(screen.queryByText(/^0 tokens/)).toBeNull()
  })

  it('shows what the agents below add up to alone, and marks it as possibly low', () => {
    render(
      <InspectorTotals
        tokens={null}
        cost={cost}
        rollup={{ tokens: 3000, below: 2, incomplete: false }}
        unreadableLines={false}
      />
    )

    expect(screen.getByText(/3K tokens incl\. 2 below/).textContent).toContain('¹')
  })

  it('does not mark the note when there are no agents below', () => {
    render(<InspectorTotals tokens={null} cost={cost} rollup={noBelow} unreadableLines={false} />)

    expect(screen.getByText('No agents below').textContent).not.toContain('¹')
  })
})

describe('InspectorTotals with the agent’s own tokens recorded', () => {
  it('adds the agents below to its own tokens without marking a complete total', () => {
    render(
      <InspectorTotals
        tokens={1000}
        cost={cost}
        rollup={{ tokens: 500, below: 1, incomplete: false }}
        unreadableLines={false}
      />
    )

    expect(screen.getByText(/1\.5K tokens incl\. 1 below/).textContent).not.toContain('¹')
  })
})
