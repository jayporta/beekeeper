import { render, screen } from '@testing-library/react'
import { createRef } from 'react'
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

  it('drops its padding when flush', () => {
    const plain = render(<Card>Body</Card>).container.firstElementChild
    const flush = render(<Card flush>Body</Card>).container.firstElementChild

    expect(flush?.classList.length).toBe((plain?.classList.length ?? 0) + 1)
  })

  it('passes a role, a name, a tab stop and a ref through to its element', () => {
    const ref = createRef<HTMLElement>()
    render(
      <Card role="region" label="Inspector" tabIndex={0} ref={ref}>
        Body
      </Card>
    )

    const region = screen.getByRole('region', { name: 'Inspector' })

    expect(region.getAttribute('tabindex')).toBe('0')
    expect(ref.current).toBe(region)
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

  it('reports whether it is busy', () => {
    const { container } = render(<Card busy>Body</Card>)

    expect(container.firstElementChild?.getAttribute('aria-busy')).toBe('true')
  })

  it('sets no busy state when it is not told', () => {
    const { container } = render(<Card>Body</Card>)

    expect(container.firstElementChild?.hasAttribute('aria-busy')).toBe(false)
  })
})
