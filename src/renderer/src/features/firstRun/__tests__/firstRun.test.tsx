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

  it('moves focus to the main landmark after the first-launch Got it', async () => {
    render(<App />)
    await dismiss()

    expect(document.activeElement).toBe(screen.getByRole('main'))
  })

  it('returns focus to About Beekeeper when Got it closes a reopened screen', async () => {
    render(<App />)
    await dismiss()
    await userEvent.click(screen.getByRole('button', { name: 'About Beekeeper' }))
    await welcome()

    await dismiss()

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'About Beekeeper' }))
  })

  it('takes focus on its heading when it appears', async () => {
    render(<App />)

    const heading = await welcome()

    expect(document.activeElement).toBe(heading)
  })

  describe('with a stored dismissal', () => {
    const seedDismissal = (): Promise<void> =>
      idbStorage.setItem('first-run', JSON.stringify({ state: { dismissed: true }, version: 0 }))

    it('stays hidden on the next launch, once the store rehydrates from IndexedDB', async () => {
      // The store singleton starts each test not dismissed, as on a fresh launch.
      await seedDismissal()

      render(<App />)

      expect(await screen.findByRole('heading', { level: 1, name: 'Sessions' })).toBeTruthy()
      expect(screen.queryByRole('heading', { name: 'Welcome to Beekeeper' })).toBeNull()
    })

    it('does not move focus to the main landmark on launch', async () => {
      await seedDismissal()

      render(<App />)
      await screen.findByRole('heading', { level: 1, name: 'Sessions' })

      expect(document.activeElement).not.toBe(screen.getByRole('main'))
    })
  })

  it('has no About Beekeeper button while the screen shows, since it would do nothing', async () => {
    render(<App />)
    await welcome()

    expect(screen.queryByRole('button', { name: 'About Beekeeper' })).toBeNull()
  })

  it('shows the About Beekeeper button once the screen is dismissed', async () => {
    render(<App />)
    await dismiss()

    expect(screen.getByRole('button', { name: 'About Beekeeper' })).toBeTruthy()
  })

  it('puts focus on the heading when About Beekeeper reopens the screen', async () => {
    render(<App />)
    await dismiss()

    await userEvent.click(screen.getByRole('button', { name: 'About Beekeeper' }))

    expect(document.activeElement).toBe(await welcome())
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

  it('still closes when the write fails, handling the rejection and logging a fixed message', async () => {
    // A thenable records whether anything subscribed to the rejection, which an
    // ignored promise would not have.
    const subscribed = vi.fn()
    const failingWrite = {
      then(_resolve: unknown, reject: (reason: Error) => void) {
        subscribed()
        reject(new Error('quota exceeded'))
      }
    }
    vi.spyOn(idbStorage, 'setItem').mockReturnValue(failingWrite as unknown as Promise<void>)
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(<App />)

    await dismiss()

    expect(screen.getByRole('heading', { level: 1, name: 'Sessions' })).toBeTruthy()
    await vi.waitFor(() => {
      expect(log).toHaveBeenCalledWith('Beekeeper could not save "first-run" to IndexedDB.')
    })
    expect(subscribed).toHaveBeenCalled()
  })

  it('still shows the screen when the stored state cannot be read', async () => {
    vi.spyOn(idbStorage, 'getItem').mockRejectedValue(new Error('storage unavailable'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    render(<App />)

    expect(await welcome()).toBeTruthy()
  })
})
