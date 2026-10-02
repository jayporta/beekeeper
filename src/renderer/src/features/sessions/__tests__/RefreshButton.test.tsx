import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RefreshButton } from '../RefreshButton'
import { STATUS_ANNOUNCE_DELAY_MS } from '../statusAnnounceDelay'

describe('RefreshButton', () => {
  it('calls onRefresh when clicked', async () => {
    const onRefresh = vi.fn()
    render(<RefreshButton onRefresh={onRefresh} status="idle" />)

    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }))

    expect(onRefresh).toHaveBeenCalledOnce()
  })

  it('names itself Refreshing while a refresh runs', () => {
    render(<RefreshButton onRefresh={vi.fn()} status="refreshing" />)

    expect(screen.queryByRole('button', { name: 'Refreshing' })).not.toBeNull()
  })

  it('ignores a click while a refresh runs', async () => {
    const onRefresh = vi.fn()
    render(<RefreshButton onRefresh={onRefresh} status="refreshing" />)

    await userEvent.click(screen.getByRole('button', { name: 'Refreshing' }))

    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('marks itself busy without leaving the tab order while a refresh runs', async () => {
    render(<RefreshButton onRefresh={vi.fn()} status="refreshing" />)

    const button = screen.getByRole('button', { name: 'Refreshing' })
    await userEvent.tab()

    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(document.activeElement).toBe(button)
  })

  it('keeps focus on the button after a click', async () => {
    render(<RefreshButton onRefresh={vi.fn()} status="idle" />)

    const button = screen.getByRole('button', { name: 'Refresh' })
    await userEvent.click(button)

    expect(document.activeElement).toBe(button)
  })

  it('calls onRefresh when clicked after a failure', async () => {
    const onRefresh = vi.fn()
    render(<RefreshButton onRefresh={onRefresh} status="failed" />)

    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }))

    expect(onRefresh).toHaveBeenCalledOnce()
  })

  it.each(['idle', 'refreshing', 'refreshed', 'failed'] as const)(
    'keeps the status region visually hidden when the status is %s',
    (status) => {
      render(<RefreshButton onRefresh={vi.fn()} status={status} />)

      expect(screen.getByRole('status').className).toContain('visuallyHidden')
    }
  )

  describe('the status text', () => {
    const FAILURE = "Couldn't refresh the lists."
    const statusText = (): string => screen.getByRole('status').textContent

    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('is empty when the button mounts with a failure, and holds it after the delay', () => {
      render(<RefreshButton onRefresh={vi.fn()} status="failed" />)

      expect(statusText()).toBe('')

      vi.advanceTimersByTime(STATUS_ANNOUNCE_DELAY_MS)

      expect(statusText()).toBe(FAILURE)
    })

    it('shows the failure note at once, hidden from assistive tech, while the status is still empty', () => {
      render(<RefreshButton onRefresh={vi.fn()} status="failed" />)

      const note = screen.getByText(FAILURE)

      expect(note.getAttribute('aria-hidden')).toBe('true')
      expect(note).not.toBe(screen.getByRole('status'))
      expect(statusText()).toBe('')
    })

    it('shows no failure note unless the refresh failed', () => {
      render(<RefreshButton onRefresh={vi.fn()} status="refreshed" />)
      vi.advanceTimersByTime(STATUS_ANNOUNCE_DELAY_MS)

      expect(screen.queryAllByText(FAILURE)).toHaveLength(0)
    })

    it('announces that the lists were updated, after the delay', () => {
      render(<RefreshButton onRefresh={vi.fn()} status="refreshed" />)
      vi.advanceTimersByTime(STATUS_ANNOUNCE_DELAY_MS)

      expect(statusText()).toBe('Lists updated')
    })

    it('stays empty when no refresh has finished', () => {
      render(<RefreshButton onRefresh={vi.fn()} status="idle" />)
      vi.advanceTimersByTime(STATUS_ANNOUNCE_DELAY_MS)

      expect(statusText()).toBe('')
    })

    it('empties and then refills for a failure that returns within a few milliseconds', () => {
      const { rerender } = render(<RefreshButton onRefresh={vi.fn()} status="failed" />)
      vi.advanceTimersByTime(STATUS_ANNOUNCE_DELAY_MS)
      expect(statusText()).toBe(FAILURE)

      rerender(<RefreshButton onRefresh={vi.fn()} status="refreshing" />)
      expect(statusText()).toBe('')
      vi.advanceTimersByTime(3)
      rerender(<RefreshButton onRefresh={vi.fn()} status="failed" />)

      expect(statusText()).toBe('')
      vi.advanceTimersByTime(STATUS_ANNOUNCE_DELAY_MS - 1)
      expect(statusText()).toBe('')
      vi.advanceTimersByTime(1)
      expect(statusText()).toBe(FAILURE)
    })

    it('adds the text after the region is in the page, so it is announced', () => {
      const added: string[] = []
      const observer = new MutationObserver(() => undefined)
      observer.observe(document.body, { childList: true, subtree: true })

      render(<RefreshButton onRefresh={vi.fn()} status="failed" />)
      vi.advanceTimersByTime(STATUS_ANNOUNCE_DELAY_MS)

      for (const record of observer.takeRecords()) {
        if (
          record.target instanceof HTMLElement &&
          record.target.getAttribute('role') === 'status'
        ) {
          record.addedNodes.forEach((node) => added.push(node.textContent ?? ''))
        }
      }
      observer.disconnect()
      expect(added).toEqual([FAILURE])
    })

    it('sets nothing, and does not throw, when it unmounts before the delay', () => {
      const { unmount } = render(<RefreshButton onRefresh={vi.fn()} status="failed" />)
      const region = screen.getByRole('status')

      unmount()
      vi.advanceTimersByTime(STATUS_ANNOUNCE_DELAY_MS)

      expect(region.textContent).toBe('')
    })
  })
})
