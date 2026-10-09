import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { LiveUpdatesToggle } from '../LiveUpdatesToggle'
import { useLiveUpdatesStore } from '../state/useLiveUpdatesStore'

afterEach(() => {
  useLiveUpdatesStore.setState({ paused: false, unavailable: false })
})

const checkbox = (): HTMLInputElement =>
  screen.getByRole<HTMLInputElement>('checkbox', { name: 'Live updates' })

describe('LiveUpdatesToggle', () => {
  it('starts checked', () => {
    render(<LiveUpdatesToggle />)

    expect(checkbox().checked).toBe(true)
  })

  it('pauses live updates when unchecked and resumes them when checked again', async () => {
    const user = userEvent.setup()
    render(<LiveUpdatesToggle />)

    await user.click(checkbox())
    expect(useLiveUpdatesStore.getState().paused).toBe(true)
    expect(checkbox().checked).toBe(false)

    await user.click(checkbox())
    expect(useLiveUpdatesStore.getState().paused).toBe(false)
    expect(checkbox().checked).toBe(true)
  })

  it('toggles with the space key when focused', async () => {
    const user = userEvent.setup()
    render(<LiveUpdatesToggle />)
    await user.tab()
    expect(document.activeElement).toBe(checkbox())

    await user.keyboard(' ')

    expect(useLiveUpdatesStore.getState().paused).toBe(true)
  })

  it('shows as unchecked while paused from elsewhere', () => {
    useLiveUpdatesStore.setState({ paused: true })
    render(<LiveUpdatesToggle />)

    expect(checkbox().checked).toBe(false)
  })

  it('has no note and no description while live updates work', () => {
    render(<LiveUpdatesToggle />)

    expect(screen.queryByText(/unavailable/)).toBeNull()
    expect(checkbox().getAttribute('aria-describedby')).toBeNull()
  })

  describe('when live updates are unavailable', () => {
    it('is disabled and unchecked', () => {
      useLiveUpdatesStore.setState({ unavailable: true })
      render(<LiveUpdatesToggle />)

      expect(checkbox().disabled).toBe(true)
      expect(checkbox().checked).toBe(false)
    })

    it('shows the note and describes the checkbox by it', () => {
      useLiveUpdatesStore.setState({ unavailable: true })
      render(<LiveUpdatesToggle />)

      expect(
        screen.getByRole('checkbox', {
          name: 'Live updates',
          description: 'Live updates are unavailable. Use Refresh to reload.'
        })
      ).toBeTruthy()
    })

    it('is unchecked even when it was not paused', () => {
      useLiveUpdatesStore.setState({ unavailable: true, paused: false })
      render(<LiveUpdatesToggle />)

      expect(checkbox().checked).toBe(false)
    })
  })
})
