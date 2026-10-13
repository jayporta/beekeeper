import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TokenClassBar } from '../TokenClassBar'

const classes = (
  input: number,
  output: number,
  cacheRead: number,
  cacheWrite: number
): Parameters<typeof TokenClassBar>[0]['classes'] => [
  { tokenClass: 'input', tokens: input },
  { tokenClass: 'output', tokens: output },
  { tokenClass: 'cacheRead', tokens: cacheRead },
  { tokenClass: 'cacheWrite', tokens: cacheWrite }
]

/** The widths of the bar's segments, in order. */
function widths(container: HTMLElement): (string | undefined)[] {
  return [...container.querySelectorAll<HTMLElement>('[style]')].map((el) => el.style.inlineSize)
}

describe('TokenClassBar', () => {
  it('sizes each segment by its share of the total', () => {
    const { container } = render(<TokenClassBar classes={classes(50, 25, 25, 0)} />)

    expect(widths(container)).toEqual(['50%', '25%', '25%'])
  })

  it('does not draw a class with no tokens', () => {
    const { container } = render(<TokenClassBar classes={classes(0, 10, 0, 0)} />)

    expect(widths(container)).toEqual(['100%'])
  })

  it('draws nothing when there are no tokens at all', () => {
    const { container } = render(<TokenClassBar classes={classes(0, 0, 0, 0)} />)

    expect(container.firstChild).toBeNull()
  })

  it('is hidden from assistive technology', () => {
    const { container } = render(<TokenClassBar classes={classes(1, 1, 0, 0)} />)

    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true')
  })
})
