import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Card } from '../Card'

describe('Card', () => {
  it('renders its children', () => {
    render(
      <Card>
        <h2>Projects</h2>
      </Card>
    )

    expect(screen.getByRole('heading', { name: 'Projects' })).toBeDefined()
  })

  it('renders a div by default', () => {
    const { container } = render(<Card>Body</Card>)

    expect(container.firstElementChild?.tagName).toBe('DIV')
  })

  it.each([['section'], ['header']] as const)('renders a %s when asked for one', (as) => {
    const { container } = render(<Card as={as}>Body</Card>)

    expect(container.firstElementChild?.tagName).toBe(as.toUpperCase())
  })

  it('adds the caller’s class to its own', () => {
    const { container } = render(<Card className="extra">Body</Card>)

    expect(container.firstElementChild?.classList.contains('extra')).toBe(true)
    expect(container.firstElementChild?.classList.length).toBe(2)
  })

  it('passes an aria-labelledby through to name a section', () => {
    render(
      <Card as="section" labelledBy="title">
        <h2 id="title">Projects</h2>
      </Card>
    )

    expect(screen.getByRole('region', { name: 'Projects' })).toBeDefined()
  })
})
