import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SeriesFill } from '../SeriesFill'

describe('SeriesFill', () => {
  it('is hidden from assistive technology, since the series is named in text', () => {
    const { container } = render(<SeriesFill index={0} />)

    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true')
  })

  it('carries its tooltip and takes its share of the stack by flex-grow', () => {
    const { container } = render(<SeriesFill index={1} title="Tip" grow={12} />)

    const fill = container.firstElementChild as HTMLElement
    expect(fill.getAttribute('title')).toBe('Tip')
    expect(fill.style.flexGrow).toBe('12')
  })

  it('adds the caller’s class to its own', () => {
    const { container } = render(<SeriesFill index={2} className="extra" />)

    expect(container.firstElementChild?.classList.contains('extra')).toBe(true)
    expect(container.firstElementChild?.classList.length).toBe(2)
  })

  it('has a different class for each of the five series', () => {
    const classes = [0, 1, 2, 3, 4].map(
      (index) => render(<SeriesFill index={index} />).container.firstElementChild?.className
    )

    expect(new Set(classes).size).toBe(5)
  })
})
