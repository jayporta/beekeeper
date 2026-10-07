import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CapsText } from '../CapsText'

describe('CapsText', () => {
  it('renders its text in a paragraph by default', () => {
    render(<CapsText>Last 7 days</CapsText>)

    expect(screen.getByText('Last 7 days').tagName).toBe('P')
  })

  it('renders a span when asked for one', () => {
    render(<CapsText as="span">Tokens</CapsText>)

    expect(screen.getByText('Tokens').tagName).toBe('SPAN')
  })

  it('renders a level 3 heading when asked for one', () => {
    render(<CapsText as="h3">Phases</CapsText>)

    expect(screen.getByRole('heading', { level: 3, name: 'Phases' })).toBeDefined()
  })

  it('puts its id on the element', () => {
    render(<CapsText id="label">Projects</CapsText>)

    expect(screen.getByText('Projects').id).toBe('label')
  })

  it("adds the caller's class to its own", () => {
    render(<CapsText className="extra">Projects</CapsText>)

    expect(screen.getByText('Projects').classList.contains('extra')).toBe(true)
  })

  it('colors the text differently when it is an accent', () => {
    render(
      <>
        <CapsText>Muted</CapsText>
        <CapsText accent>Accent</CapsText>
      </>
    )

    expect(screen.getByText('Accent').className).not.toBe(screen.getByText('Muted').className)
  })
})
