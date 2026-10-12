import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProjectDot } from '../ProjectDot'
import { projectColorClass } from '../projectColorClass'

function renderDot(element: React.JSX.Element): Element {
  const { container } = render(element)
  const dot = container.firstElementChild
  if (dot === null) throw new Error('The dot did not render')
  return dot
}

describe('ProjectDot', () => {
  it.each(['solid', 'ring'] as const)('hides a %s dot from assistive technology', (variant) => {
    const dot = renderDot(<ProjectDot variant={variant} slot={2} />)

    expect(dot.getAttribute('aria-hidden')).toBe('true')
  })

  it('hides the all-projects square from assistive technology', () => {
    const dot = renderDot(<ProjectDot variant="all" />)

    expect(dot.getAttribute('aria-hidden')).toBe('true')
  })

  it.each(['solid', 'ring'] as const)("carries its slot's class when %s", (variant) => {
    const dot = renderDot(<ProjectDot variant={variant} slot={3} />)

    expect(dot.classList.contains(projectColorClass(3))).toBe(true)
    expect(dot.classList.contains(projectColorClass(4))).toBe(false)
  })

  it('looks different as a solid dot, a ring and the all-projects square', () => {
    const solid = renderDot(<ProjectDot variant="solid" slot={1} />).className
    const ring = renderDot(<ProjectDot variant="ring" slot={1} />).className
    const all = renderDot(<ProjectDot variant="all" />).className

    expect(new Set([solid, ring, all]).size).toBe(3)
  })
})
