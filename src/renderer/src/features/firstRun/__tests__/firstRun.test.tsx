import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { idbStorage } from '@renderer/storage/idbStorage'
import { installBeekeeperApi } from '@renderer/testBeekeeperApi'
import { renderApp, resetPersistedState } from '@renderer/testRenderApp'
import { useFirstRunStore } from '../state/useFirstRunStore'

beforeEach(() => {
  installBeekeeperApi()
})

afterEach(async () => {
  vi.restoreAllMocks()
  await resetPersistedState()
})

const welcome = (): Promise<HTMLElement> =>
  screen.findByRole('heading', { level: 1, name: 'Welcome to Beekeeper' })

async function dismiss(): Promise<void> {
  await userEvent.click(await screen.findByRole('button', { name: 'Got it' }))
}

describe('first-run screen', () => {
  it('shows on first launch', async () => {
    renderApp()

    expect(await welcome()).toBeTruthy()
    expect(
      screen.getByRole('heading', { level: 2, name: 'Nothing leaves your computer' })
    ).toBeTruthy()
  })

  it('renders neither the screen nor the main view before the stored state is read', () => {
    renderApp()

    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
    expect(screen.queryByRole('button', { name: 'About Beekeeper' })).toBeNull()
  })

  it('hides after Got it and shows the sessions view', async () => {
    renderApp()
    await dismiss()

    expect(screen.queryByRole('heading', { name: 'Welcome to Beekeeper' })).toBeNull()
    expect(await screen.findByRole('heading', { level: 1, name: '-Users-a-repo' })).toBeTruthy()
  })

  it('moves focus to the main landmark after the first-launch Got it', async () => {
    renderApp()
    await dismiss()

    expect(document.activeElement).toBe(screen.getByRole('main'))
  })

  it('returns focus to About Beekeeper when Got it closes a reopened screen', async () => {
    renderApp()
    await dismiss()
    await userEvent.click(screen.getByRole('button', { name: 'About Beekeeper' }))
    await welcome()

    await dismiss()

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'About Beekeeper' }))
  })

  it('takes focus on its heading when it appears', async () => {
    renderApp()

    const heading = await welcome()

    // The heading mounts when the store rehydrates outside act, so the effect
    // that focuses it can run after the heading is found.
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(heading)
    })
  })

  describe('with a stored dismissal', () => {
    const seedDismissal = (): Promise<void> =>
      idbStorage.setItem('first-run', JSON.stringify({ state: { dismissed: true }, version: 0 }))

    it('stays hidden on the next launch, once the store rehydrates from IndexedDB', async () => {
      // The store singleton starts each test not dismissed, as on a fresh launch.
      await seedDismissal()

      renderApp()

      expect(await screen.findByRole('heading', { level: 1, name: '-Users-a-repo' })).toBeTruthy()
      expect(screen.queryByRole('heading', { name: 'Welcome to Beekeeper' })).toBeNull()
    })

    it('does not move focus to the main landmark on launch', async () => {
      await seedDismissal()

      renderApp()
      await screen.findByRole('heading', { level: 1, name: '-Users-a-repo' })

      expect(document.activeElement).not.toBe(screen.getByRole('main'))
    })
  })

  describe('with a stored value that cannot be trusted', () => {
    const seed = (value: string): Promise<void> => idbStorage.setItem('first-run', value)

    it('shows the screen, and logs one fixed message, for a stored value that is not JSON', async () => {
      const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
      await seed('not json {secret transcript text')

      renderApp()

      expect(await welcome()).toBeTruthy()
      expect(log).toHaveBeenCalledExactlyOnceWith(
        'Beekeeper could not restore "first-run" from IndexedDB.'
      )
    })

    it('shows the screen when the stored dismissed is not a boolean', async () => {
      await seed(JSON.stringify({ state: { dismissed: 'false' }, version: 0 }))

      renderApp()

      expect(await welcome()).toBeTruthy()
    })

    it('keeps the store actions when the stored value has keys of the same name', async () => {
      await seed(
        JSON.stringify({ state: { dismissed: true, dismiss: 'x', open: 'y' }, version: 0 })
      )

      renderApp()
      await userEvent.click(await screen.findByRole('button', { name: 'About Beekeeper' }))

      expect(await welcome()).toBeTruthy()
    })
  })

  it('has no About Beekeeper button while the screen shows, since it would do nothing', async () => {
    renderApp()
    await welcome()

    expect(screen.queryByRole('button', { name: 'About Beekeeper' })).toBeNull()
  })

  it('shows the About Beekeeper button once the screen is dismissed', async () => {
    renderApp()
    await dismiss()

    expect(screen.getByRole('button', { name: 'About Beekeeper' })).toBeTruthy()
  })

  it('puts focus on the heading when About Beekeeper reopens the screen', async () => {
    renderApp()
    await dismiss()

    await userEvent.click(screen.getByRole('button', { name: 'About Beekeeper' }))

    expect(document.activeElement).toBe(await welcome())
  })

  it('reopens from About Beekeeper and closes again with Got it', async () => {
    renderApp()
    await dismiss()

    await userEvent.click(screen.getByRole('button', { name: 'About Beekeeper' }))
    expect(await welcome()).toBeTruthy()

    await dismiss()
    expect(await screen.findByRole('heading', { level: 1, name: '-Users-a-repo' })).toBeTruthy()
  })

  it('does not persist the reopened state', async () => {
    renderApp()
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
    renderApp()

    await dismiss()

    expect(await screen.findByRole('heading', { level: 1, name: '-Users-a-repo' })).toBeTruthy()
    await vi.waitFor(() => {
      expect(log).toHaveBeenCalledWith('Beekeeper could not save "first-run" to IndexedDB.')
    })
    expect(subscribed).toHaveBeenCalled()
  })

  it('still shows the screen when the stored state cannot be read, logging one fixed message', async () => {
    vi.spyOn(idbStorage, 'getItem').mockRejectedValue(new Error('storage unavailable'))
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    renderApp()

    expect(await welcome()).toBeTruthy()
    // Every store reads through the same failing storage, so each logs its own message.
    expect(
      log.mock.calls.filter(
        ([message]) => message === 'Beekeeper could not restore "first-run" from IndexedDB.'
      )
    ).toHaveLength(1)
  })
})
