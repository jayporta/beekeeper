import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MutedText } from '../MutedText'

describe('MutedText', () => {
  it('renders its text in a paragraph by default', () => {
    render(<MutedText>2 agents</MutedText>)

    expect(screen.getByText('2 agents').tagName).toBe('P')
  })

  it('renders a span when asked for one', () => {
    render(<MutedText as="span">+3 more</MutedText>)

    expect(screen.getByText('+3 more').tagName).toBe('SPAN')
  })

  it('renders a div when asked for one', () => {
    render(<MutedText as="div">Legend</MutedText>)

    expect(screen.getByText('Legend').tagName).toBe('DIV')
  })

  it('puts its id on the element', () => {
    render(<MutedText id="note">Partial</MutedText>)

    expect(screen.getByText('Partial').id).toBe('note')
  })

  it("adds the caller's class to its own", () => {
    render(<MutedText className="extra">Note</MutedText>)

    expect(screen.getByText('Note').classList.contains('extra')).toBe(true)
  })

  it('styles smaller text differently', () => {
    render(
      <>
        <MutedText>Regular</MutedText>
        <MutedText smaller>Smaller</MutedText>
      </>
    )

    expect(screen.getByText('Smaller').className).not.toBe(screen.getByText('Regular').className)
  })

  it('styles text that wraps anywhere differently', () => {
    render(
      <>
        <MutedText>Regular</MutedText>
        <MutedText wrapAnywhere>Wraps</MutedText>
      </>
    )

    expect(screen.getByText('Wraps').className).not.toBe(screen.getByText('Regular').className)
  })

  it('hides decorative text from assistive technology', () => {
    render(<MutedText decorative>Legend</MutedText>)

    expect(screen.getByText('Legend').getAttribute('aria-hidden')).toBe('true')
  })

  it('leaves other text exposed to assistive technology', () => {
    render(<MutedText>Note</MutedText>)

    expect(screen.getByText('Note').hasAttribute('aria-hidden')).toBe(false)
  })

  it('announces a note given the status role', () => {
    render(<MutedText role="status">Loading</MutedText>)

    expect(screen.getByRole('status').textContent).toBe('Loading')
  })

  it('has no status role unless asked for one', () => {
    render(<MutedText>Note</MutedText>)

    expect(screen.queryByRole('status')).toBeNull()
  })
})
