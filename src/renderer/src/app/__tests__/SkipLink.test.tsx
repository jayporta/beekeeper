import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { SkipLink } from '../SkipLink'

describe('SkipLink', () => {
  it('moves focus to the target when activated by keyboard', async () => {
    const target = { current: null as HTMLElement | null }
    render(
      <>
        <SkipLink target={target} />
        <nav>
          <button type="button">Sidebar control</button>
        </nav>
        <main
          ref={(element) => {
            target.current = element
          }}
          tabIndex={-1}
        >
          Main
        </main>
      </>
    )

    await userEvent.tab()
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Skip to main content' }))
    await userEvent.keyboard('{Enter}')

    expect(document.activeElement).toBe(screen.getByRole('main'))
  })

  it('does not change the page address', async () => {
    const target = { current: document.body }
    render(<SkipLink target={target} />)
    const before = window.location.href

    await userEvent.click(screen.getByRole('link', { name: 'Skip to main content' }))

    expect(window.location.href).toBe(before)
  })
})
