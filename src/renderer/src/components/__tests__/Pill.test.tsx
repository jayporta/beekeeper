import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Pill } from '../Pill'

describe('Pill', () => {
  it('renders its text in a span with no role', () => {
    render(<Pill tone="error">2 tool errors</Pill>)

    const pill = screen.getByText('2 tool errors')
    expect(pill.tagName).toBe('SPAN')
    expect(pill.hasAttribute('role')).toBe(false)
  })

  it('styles each tone differently', () => {
    render(
      <>
        <Pill tone="error">error</Pill>
        <Pill tone="warning">warning</Pill>
        <Pill tone="neutral">neutral</Pill>
        <Pill tone="info">info</Pill>
        <Pill tone="success">success</Pill>
        <Pill tone="edit">edit</Pill>
      </>
    )

    const classes = ['error', 'warning', 'neutral', 'info', 'success', 'edit'].map(
      (name) => screen.getByText(name).className
    )
    expect(new Set(classes).size).toBe(6)
  })
})
