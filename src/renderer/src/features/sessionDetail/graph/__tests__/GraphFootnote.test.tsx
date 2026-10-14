import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GraphFootnote } from '../GraphFootnote'

const renderFootnote = (partial = false): void => {
  render(
    <GraphFootnote
      partial={partial}
      partialWorkflow={false}
      missingTeammates={0}
      teamListsTruncated={false}
    />
  )
}

describe('GraphFootnote', () => {
  it('leaves the legend to the card’s header', () => {
    renderFootnote()

    expect(screen.queryByText('× tool errors')).toBeNull()
  })
})

describe('GraphFootnote partial note', () => {
  it('names signal counts among what a partial node may be missing', () => {
    renderFootnote(true)

    expect(screen.getByText(/signal counts may be incomplete/)).toBeTruthy()
  })
})
