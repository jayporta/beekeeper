import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PartialMarker } from '../PartialMarker'

describe('PartialMarker', () => {
  it('points a reader below the list by default', () => {
    render(<PartialMarker />)

    expect(screen.getByText('partial, see the note below the list')).toBeTruthy()
  })

  it('speaks the note it is given in place of the list’s', () => {
    render(<PartialMarker note="partial, see below" />)

    expect(screen.getByText('partial, see below')).toBeTruthy()
    expect(screen.queryByText('partial, see the note below the list')).toBeNull()
  })
})
