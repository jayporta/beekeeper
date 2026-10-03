import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SeparatedText } from '../SeparatedText'

describe('SeparatedText', () => {
  it('joins the parts with a separator that assistive technology skips', () => {
    const { container } = render(<SeparatedText parts={['Jan 15', 'claude-opus-5', 'stopped']} />)

    const separators = container.querySelectorAll('[aria-hidden="true"]')
    expect(container.textContent).toBe('Jan 15 · claude-opus-5 · stopped')
    expect(separators).toHaveLength(2)
  })

  it('shows a single part with no separator', () => {
    const { container } = render(<SeparatedText parts={['only']} />)

    expect(container.textContent).toBe('only')
    expect(container.querySelector('[aria-hidden]')).toBeNull()
  })

  it('shows nothing for no parts', () => {
    const { container } = render(<SeparatedText parts={[]} />)

    expect(container.textContent).toBe('')
  })
})
