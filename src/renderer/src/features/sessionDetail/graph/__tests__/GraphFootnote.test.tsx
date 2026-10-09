import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GraphFootnote } from '../GraphFootnote'

const renderFootnote = (marks: boolean): void => {
  render(
    <GraphFootnote
      partial={false}
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

    expect(screen.getByText('× tool errors ▲ compactions ■ stopped')).toBeTruthy()
  })

  it('leaves the legend out when no node has marks', () => {
    renderFootnote(false)

    expect(screen.queryByText(/compactions/)).toBeNull()
  })
})
