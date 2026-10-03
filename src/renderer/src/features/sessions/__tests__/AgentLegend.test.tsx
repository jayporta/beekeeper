import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AgentLegend } from '../AgentLegend'

describe('AgentLegend', () => {
  it('names each kind it is given beside its mark, in the order given', () => {
    const { container } = render(<AgentLegend kinds={['lead', 'teammate', 'subagent']} />)

    expect(container.textContent?.trim()).toBe('Lead Teammate Subagent')
    expect(
      [...container.querySelectorAll('[data-kind]')].map((mark) => mark.getAttribute('data-kind'))
    ).toEqual(['lead', 'teammate', 'subagent'])
  })

  it('leaves out the kinds it is not given', () => {
    render(<AgentLegend kinds={['lead']} />)

    expect(screen.queryByText('Teammate')).toBeNull()
    expect(screen.queryByText('Subagent')).toBeNull()
  })

  it('hides itself from assistive technology, as the strip it explains is', () => {
    const { container } = render(<AgentLegend kinds={['lead']} />)

    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true')
  })

  it('renders nothing for no kinds', () => {
    const { container } = render(<AgentLegend kinds={[]} />)

    expect(container.textContent).toBe('')
    expect(container.firstElementChild).toBeNull()
  })
})
