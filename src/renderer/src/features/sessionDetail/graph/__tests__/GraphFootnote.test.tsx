import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GraphFootnote } from '../GraphFootnote'

const renderFootnote = (marks: boolean, partial = false): void => {
  render(
    <GraphFootnote
      partial={partial}
      partialWorkflow={false}
      marks={marks}
      missingTeammates={0}
      teamListsTruncated={false}
    />
  )
}

describe('GraphFootnote legend', () => {
  it('explains the marks when a node has them', () => {
    renderFootnote(true)

    expect(screen.getByText('× tool errors')).toBeTruthy()
    expect(screen.getByText('▲ compactions')).toBeTruthy()
    expect(screen.getByText('■ stopped')).toBeTruthy()
  })

  it('leaves the legend out when no node has marks', () => {
    renderFootnote(false)

    expect(screen.queryByText(/compactions/)).toBeNull()
  })
})

describe('GraphFootnote partial note', () => {
  it('names signal counts among what a partial node may be missing', () => {
    renderFootnote(false, true)

    expect(screen.getByText(/signal counts may be incomplete/)).toBeTruthy()
  })
})
