import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TitleRow } from '../TitleRow'

describe('TitleRow', () => {
  it('renders its children', () => {
    render(
      <TitleRow>
        <h1>Title</h1>
        <button type="button">Action</button>
      </TitleRow>
    )

    expect(screen.getByRole('heading', { name: 'Title' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Action' })).toBeDefined()
  })

  it('renders a div by default', () => {
    const { container } = render(<TitleRow>Title</TitleRow>)

    expect(container.firstElementChild?.tagName).toBe('DIV')
  })

  it('renders a header when asked for one', () => {
    const { container } = render(<TitleRow as="header">Title</TitleRow>)

    expect(container.firstElementChild?.tagName).toBe('HEADER')
  })
})
