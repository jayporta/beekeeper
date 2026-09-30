import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '@renderer/App'
import { idbStorage } from '@renderer/storage/idbStorage'
import { useFirstRunStore } from '../state/useFirstRunStore'
import { resetFirstRun } from '../testFirstRunReset'

afterEach(async () => {
  vi.restoreAllMocks()
  await resetFirstRun()
})

const welcome = (): Promise<HTMLElement> =>
  screen.findByRole('heading', { level: 1, name: 'Welcome to Beekeeper' })

async function dismiss(): Promise<void> {
  await userEvent.click(await screen.findByRole('button', { name: 'Got it' }))
}

describe('first-run screen', () => {
  it('shows on first launch', async () => {
    render(<App />)

    expect(await welcome()).toBeTruthy()
    expect(
      screen.getByRole('heading', { level: 2, name: 'Nothing leaves your computer' })
    ).toBeTruthy()
  })

  it('renders neither the screen nor the main view before the stored state is read', () => {
    render(<App />)

    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
    expect(screen.queryByRole('button', { name: 'About Beekeeper' })).toBeNull()
  })

  it('hides after Got it and shows the sessions view', async () => {
    render(<App />)
    await dismiss()

    expect(screen.queryByRole('heading', { name: 'Welcome to Beekeeper' })).toBeNull()
    expect(screen.getByRole('heading', { level: 1, name: 'Sessions' })).toBeTruthy()
  })

  it('moves focus to the main heading after Got it', async () => {
    render(<App />)
    await dismiss()

    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'Sessions' }))
  })

  it('takes focus on its heading when it appears', async () => {
    render(<App />)

    const heading = await welcome()

    expect(document.activeElement).toBe(heading)
  })

  it('stays hidden on the next launch, once the store rehydrates from IndexedDB', async () => {
    const first = render(<App />)
    await dismiss()
    // Persisting is asynchronous: wait for the write to land before "relaunching".
    await vi.waitFor(async () => {
      expect(await idbStorage.getItem('first-run')).toContain('"dismissed":true')
    })
    first.unmount()

    render(<App />)

    expect(await screen.findByRole('heading', { level: 1, name: 'Sessions' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Welcome to Beekeeper' })).toBeNull()
  })

  it('reopens from About Beekeeper and closes again with Got it', async () => {
    render(<App />)
    await dismiss()

    await userEvent.click(screen.getByRole('button', { name: 'About Beekeeper' }))
    expect(await welcome()).toBeTruthy()

    await dismiss()
    expect(screen.getByRole('heading', { level: 1, name: 'Sessions' })).toBeTruthy()
  })

  it('does not persist the reopened state', async () => {
    render(<App />)
    await dismiss()
    await userEvent.click(screen.getByRole('button', { name: 'About Beekeeper' }))

    expect(useFirstRunStore.getState().isOpen).toBe(true)
    await vi.waitFor(async () => {
      expect(await idbStorage.getItem('first-run')).not.toContain('isOpen')
    })
  })

  it('still shows the screen when the stored state cannot be read', async () => {
    vi.spyOn(idbStorage, 'getItem').mockRejectedValue(new Error('storage unavailable'))

    render(<App />)

    expect(await welcome()).toBeTruthy()
  })
})
