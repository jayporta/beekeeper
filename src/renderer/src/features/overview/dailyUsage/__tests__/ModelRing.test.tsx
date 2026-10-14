import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { byModelTotals } from '../byModelTotals'
import { ModelRing } from '../ModelRing'
import type { Series } from '../seriesOf'

const CIRCUMFERENCE = 2 * Math.PI * 65

function ringFor(
  entries: [Series['key'], number][],
  total: number,
  partial = false
): React.JSX.Element {
  const series = entries.map(([key, tokens]) => ({ key, total: tokens }))
  return <ModelRing rows={byModelTotals(series, total)} total={total} partial={partial} />
}

function segments(container: HTMLElement): SVGCircleElement[] {
  return [...container.querySelectorAll<SVGCircleElement>('circle[data-family]')]
}

const dashOf = (circle: SVGCircleElement): number =>
  Number.parseFloat(circle.getAttribute('stroke-dasharray')?.split(' ')[0] ?? 'NaN')

describe('ModelRing', () => {
  it('is hidden from assistive technology, since the rows beside it carry the figures', () => {
    const { container } = render(ringFor([['opus', 1]], 1))

    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('draws an arc per family, as long as its share of the circle', () => {
    const { container } = render(
      ringFor(
        [
          ['opus', 3],
          ['haiku', 1]
        ],
        4
      )
    )

    const [opus, haiku] = segments(container)
    expect(opus && dashOf(opus)).toBeCloseTo(CIRCUMFERENCE * 0.75)
    expect(haiku && dashOf(haiku)).toBeCloseTo(CIRCUMFERENCE * 0.25)
  })

  it('starts each arc where the one before ends', () => {
    const { container } = render(
      ringFor(
        [
          ['opus', 3],
          ['haiku', 1]
        ],
        4
      )
    )

    const [, haiku] = segments(container)
    expect(Number(haiku?.getAttribute('stroke-dashoffset'))).toBeCloseTo(-CIRCUMFERENCE * 0.75)
  })

  it('closes the circle for a single family', () => {
    const { container } = render(ringFor([['sonnet', 9]], 9))

    const [only] = segments(container)
    expect(only && dashOf(only)).toBeCloseTo(CIRCUMFERENCE)
  })

  it('still draws a family under one percent', () => {
    const { container } = render(
      ringFor(
        [
          ['opus', 999],
          ['haiku', 1]
        ],
        1000
      )
    )

    const [, haiku] = segments(container)
    expect(haiku && dashOf(haiku)).toBeGreaterThan(0)
  })

  it('draws no arcs, and no NaN, for a zero total', () => {
    const { container } = render(ringFor([['opus', 0]], 0))

    expect(segments(container)).toHaveLength(0)
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
  })

  it('shows the compact total in the middle', () => {
    render(ringFor([['opus', 41_200_000]], 41_200_000))

    expect(screen.getByText('41.2M')).toBeTruthy()
    expect(screen.getByText('tokens')).toBeTruthy()
  })

  it('marks the total when it may be low', () => {
    render(ringFor([['opus', 5]], 5, true))

    expect(screen.getByText('5').textContent).toContain('¹')
  })

  it('leaves the marker off a complete total', () => {
    render(ringFor([['opus', 5]], 5))

    expect(screen.getByText('5').textContent).not.toContain('¹')
  })
})
