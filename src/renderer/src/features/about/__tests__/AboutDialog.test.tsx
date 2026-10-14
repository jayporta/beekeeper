import { act, fireEvent, render as renderPlain, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installBeekeeperApi, type TestBeekeeperApi } from '@renderer/testBeekeeperApi'
import { createQueryWrapper } from '@renderer/testQueryWrapper'
import { AboutDialog } from '../AboutDialog'

let api: TestBeekeeperApi

/** Renders `ui` with a fresh query client, since the dialog reads the app version through a query. */
function render(ui: React.ReactElement): ReturnType<typeof renderPlain> {
  return renderPlain(ui, { wrapper: createQueryWrapper() })
}

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

  it('says CLAUDE_CONFIG_DIR moves the folder it reads, and renders the variable as code', () => {
    render(<AboutDialog />)

    openAbout()

    expect(screen.getByText('CLAUDE_CONFIG_DIR').tagName).toBe('CODE')
  })

  it('shows the app version', async () => {
    api = installBeekeeperApi({
      getAppVersion: () => Promise.resolve({ ok: true, value: '0.1.0' })
    })
    render(<AboutDialog />)

    openAbout()

    expect(await screen.findByText('Version 0.1.0')).toBeTruthy()
  })

  it('shows no version line while the version loads', () => {
    api = installBeekeeperApi({ getAppVersion: () => new Promise(() => undefined) })
    render(<AboutDialog />)

    openAbout()

    expect(aboutDialog()).toBeTruthy()
    expect(screen.queryByText(/version/i)).toBeNull()
  })

  it('says the version could not be read when the call fails', async () => {
    api = installBeekeeperApi({
      getAppVersion: () => Promise.resolve({ ok: false, error: { code: 'internal' } })
    })
    render(<AboutDialog />)

    openAbout()

    expect(await screen.findByText('The version could not be read.')).toBeTruthy()
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
