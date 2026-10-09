import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installBeekeeperApi, type TestBeekeeperApi } from '@renderer/testBeekeeperApi'
import { AboutDialog } from '../AboutDialog'

let api: TestBeekeeperApi

beforeEach(() => {
  api = installBeekeeperApi()
})

function openAbout(): void {
  act(() => {
    api.fireOpenAbout()
  })
}

const aboutDialog = (): HTMLElement => screen.getByRole('dialog', { name: 'About beekeeper' })

describe('AboutDialog', () => {
  it('shows no dialog before the menu asks for About', () => {
    render(<AboutDialog />)

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens a dialog named About beekeeper when the menu asks for About', () => {
    render(<AboutDialog />)

    openAbout()

    expect(aboutDialog()).toBeTruthy()
  })

  it('opens when the menu asked for About before the dialog mounted', () => {
    api.fireOpenAbout()

    render(<AboutDialog />)

    expect(aboutDialog()).toBeTruthy()
  })

  it('says what beekeeper reads and that it stays on the computer', () => {
    render(<AboutDialog />)

    openAbout()

    expect(screen.getByText(/reads the session files Claude Code writes/)).toBeTruthy()
    expect(screen.getByText(/runs entirely on your computer/)).toBeTruthy()
  })

  it('closes with the Close button and returns focus to what had it before', async () => {
    render(
      <>
        <button type="button">Elsewhere</button>
        <AboutDialog />
      </>
    )
    const elsewhere = screen.getByRole('button', { name: 'Elsewhere' })
    elsewhere.focus()
    openAbout()

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(elsewhere)
  })

  it('closes when Escape cancels the dialog', () => {
    render(<AboutDialog />)
    openAbout()

    fireEvent(aboutDialog(), new Event('cancel', { cancelable: true }))

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('leaves exactly one dialog open when About is asked for twice', () => {
    render(<AboutDialog />)

    openAbout()
    openAbout()

    expect(screen.getAllByRole('dialog')).toHaveLength(1)
  })

  it('opens again after it was closed', async () => {
    render(<AboutDialog />)
    openAbout()
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    openAbout()

    expect(aboutDialog()).toBeTruthy()
  })

  it('subscribes once, and unsubscribes when it unmounts', () => {
    const unsubscribe = vi.fn()
    api = installBeekeeperApi({ onOpenAbout: () => unsubscribe })
    const { unmount } = render(<AboutDialog />)

    expect(api.onOpenAbout).toHaveBeenCalledTimes(1)
    expect(unsubscribe).not.toHaveBeenCalled()

    unmount()

    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })
})
