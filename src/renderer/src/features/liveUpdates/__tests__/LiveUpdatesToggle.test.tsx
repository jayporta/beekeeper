import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LiveUpdatesToggle } from '../LiveUpdatesToggle'
import { useLiveUpdatesStore } from '../state/useLiveUpdatesStore'

const setPausedOriginal = useLiveUpdatesStore.getState().setPaused

afterEach(() => {
  useLiveUpdatesStore.setState({ paused: false, unavailable: false, setPaused: setPausedOriginal })
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

  it('has an empty polite status region before live updates become unavailable', () => {
    render(<LiveUpdatesToggle />)

    expect(screen.getByRole('status').textContent).toBe('')
  })

  describe('when live updates are unavailable', () => {
    it('is marked disabled for assistive technology, stays focusable, and is unchecked', () => {
      useLiveUpdatesStore.setState({ unavailable: true })
      render(<LiveUpdatesToggle />)

      expect(checkbox().getAttribute('aria-disabled')).toBe('true')
      expect(checkbox().disabled).toBe(false)
      expect(checkbox().checked).toBe(false)
    })

    it('keeps focus when live updates become unavailable while it has focus', async () => {
      const user = userEvent.setup()
      render(<LiveUpdatesToggle />)
      await user.tab()
      expect(document.activeElement).toBe(checkbox())

      act(() => {
        useLiveUpdatesStore.getState().markUnavailable()
      })

      expect(checkbox().disabled).toBe(false)
      expect(document.activeElement).toBe(checkbox())
    })

    it('announces the note in the status region that was already on the page', () => {
      render(<LiveUpdatesToggle />)
      const region = screen.getByRole('status')

      act(() => {
        useLiveUpdatesStore.getState().markUnavailable()
      })

      expect(screen.getByRole('status')).toBe(region)
      expect(region.textContent).toBe('Live updates are unavailable. Use Refresh to reload.')
    })

    it('describes the checkbox by the note', () => {
      useLiveUpdatesStore.setState({ unavailable: true })
      render(<LiveUpdatesToggle />)

      expect(
        screen.getByRole('checkbox', {
          name: 'Live updates',
          description: 'Live updates are unavailable. Use Refresh to reload.'
        })
      ).toBeTruthy()
    })

    it('ignores a click: it never asks to change the pause, and stays unchecked', async () => {
      const user = userEvent.setup()
      const setPaused = vi.fn()
      useLiveUpdatesStore.setState({ unavailable: true, setPaused })
      render(<LiveUpdatesToggle />)

      await user.click(checkbox())

      expect(setPaused).not.toHaveBeenCalled()
      expect(checkbox().checked).toBe(false)
    })

    it('keeps a pause made before the failure when it is clicked', async () => {
      const user = userEvent.setup()
      useLiveUpdatesStore.setState({ unavailable: true, paused: true })
      render(<LiveUpdatesToggle />)

      await user.click(checkbox())

      expect(useLiveUpdatesStore.getState().paused).toBe(true)
    })

    it('ignores the space key: it never asks to change the pause', async () => {
      const user = userEvent.setup()
      const setPaused = vi.fn()
      useLiveUpdatesStore.setState({ unavailable: true, setPaused })
      render(<LiveUpdatesToggle />)
      await user.tab()

      await user.keyboard(' ')

      expect(setPaused).not.toHaveBeenCalled()
    })

    it('is unchecked even when it was not paused', () => {
      useLiveUpdatesStore.setState({ unavailable: true, paused: false })
      render(<LiveUpdatesToggle />)

      expect(checkbox().checked).toBe(false)
    })
  })
})
