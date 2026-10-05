import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { InspectorTotals } from '../InspectorTotals'

const cost = { usd: 1, partial: false }
const noBelow = { tokens: 0, below: 0, incomplete: false, subagentsNotLoaded: false }

describe('InspectorTotals with the agent’s own tokens not recorded', () => {
  it('says the tokens were not recorded instead of showing a figure', () => {
    render(
      <InspectorTotals
        tokens={null}
        cost={cost}
        rollup={noBelow}
        unreadableLines={false}
        subagentsUnreadable={false}
      />
    )

    expect(screen.getByText('tokens not recorded')).toBeTruthy()
    expect(screen.queryByText(/^0 tokens/)).toBeNull()
  })

  it('shows what the agents below add up to alone, and marks it as possibly low', () => {
    render(
      <InspectorTotals
        tokens={null}
        cost={cost}
        rollup={{ tokens: 3000, below: 2, incomplete: false, subagentsNotLoaded: false }}
        unreadableLines={false}
        subagentsUnreadable={false}
      />
    )

    expect(screen.getByText(/3K tokens incl\. 2 below/).textContent).toContain('¹')
  })

  it('marks the total with the agents below when their subagents are not loaded', () => {
    render(
      <InspectorTotals
        tokens={1000}
        cost={cost}
        rollup={{ tokens: 500, below: 1, incomplete: false, subagentsNotLoaded: true }}
        unreadableLines={false}
        subagentsUnreadable={false}
      />
    )

    expect(screen.getByText(/1.5K tokens incl\. 1 below/).textContent).toContain('¹')
  })

  it('does not mark the note when there are no agents below', () => {
    render(
      <InspectorTotals
        tokens={null}
        cost={cost}
        rollup={noBelow}
        unreadableLines={false}
        subagentsUnreadable={false}
      />
    )

    expect(screen.getByText('No agents below').textContent).not.toContain('¹')
  })
})

describe('InspectorTotals with the agent’s own tokens recorded', () => {
  it('adds the agents below to its own tokens without marking a complete total', () => {
    render(
      <InspectorTotals
        tokens={1000}
        cost={cost}
        rollup={{ tokens: 500, below: 1, incomplete: false, subagentsNotLoaded: false }}
        unreadableLines={false}
        subagentsUnreadable={false}
      />
    )

    expect(screen.getByText(/1\.5K tokens incl\. 1 below/).textContent).not.toContain('¹')
  })
})

describe('InspectorTotals marks', () => {
  it('says the agents below could not be read, with a marker, instead of saying there are none', () => {
    render(
      <InspectorTotals
        tokens={1000}
        cost={cost}
        rollup={noBelow}
        unreadableLines={false}
        subagentsUnreadable
      />
    )

    expect(screen.getByText(/Agents below couldn't be read/).textContent).toContain('¹')
    expect(screen.queryByText('No agents below')).toBeNull()
  })

  it('marks the total with the agents below when unreadable lines may have left tokens out of it', () => {
    render(
      <InspectorTotals
        tokens={1000}
        cost={cost}
        rollup={{ tokens: 500, below: 1, incomplete: false, subagentsNotLoaded: false }}
        unreadableLines
        subagentsUnreadable={false}
      />
    )

    expect(screen.getByText(/1\.5K tokens incl\. 1 below/).textContent).toContain('¹')
  })

  it('leaves the note on a lone agent unmarked when unreadable lines only affect its own figures', () => {
    render(
      <InspectorTotals
        tokens={1000}
        cost={cost}
        rollup={noBelow}
        unreadableLines
        subagentsUnreadable={false}
      />
    )

    expect(screen.getByText('No agents below').textContent).not.toContain('¹')
  })
})
