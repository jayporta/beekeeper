import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { InspectorList } from '../InspectorList'

describe('InspectorList', () => {
  it('renders its children as list items of a list', () => {
    render(
      <InspectorList>
        <li>one</li>
        <li>two</li>
      </InspectorList>
    )

    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual(['one', 'two'])
  })

  it('adds the class a caller passes to the list', () => {
    render(
      <InspectorList className="extra">
        <li>one</li>
      </InspectorList>
    )

    expect(screen.getByRole('list').classList.contains('extra')).toBe(true)
  })
})
