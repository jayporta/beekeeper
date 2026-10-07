import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { InspectorHeading } from '../InspectorHeading'

describe('InspectorHeading', () => {
  it('renders its content as a level 3 heading', () => {
    render(<InspectorHeading>Phases</InspectorHeading>)

    expect(screen.getByRole('heading', { level: 3, name: 'Phases' })).toBeTruthy()
  })
})
