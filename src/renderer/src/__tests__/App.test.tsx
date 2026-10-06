import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { installBeekeeperApi, type TestBeekeeperApi } from '../testBeekeeperApi'
import { renderApp, resetPersistedState } from '../testRenderApp'

let api: TestBeekeeperApi

beforeEach(() => {
  api = installBeekeeperApi()
})

function openAbout(): void {
  act(() => {
    api.fireOpenAbout()
  })
}

afterEach(resetPersistedState)

describe('App', () => {
  it('has a sidebar landmark and a main landmark', async () => {
    renderApp()

    expect(screen.getByRole('complementary', { name: 'Sidebar' })).toBeTruthy()
    expect(screen.getByRole('main')).toBeTruthy()
    await screen.findByRole('heading', { level: 1 })
  })

  it('names the app in the sidebar once loaded', async () => {
    renderApp()

    expect(await screen.findByText('Beekeeper')).toBeTruthy()
  })

  it('opens About before the stored state is read', async () => {
    renderApp()

    openAbout()

    expect(screen.getByRole('dialog', { name: 'About beekeeper' })).toBeTruthy()
    await screen.findByRole('heading', { level: 1 })
  })

  it('leaves the first-run screen showing after About opens over it and closes', async () => {
    renderApp()
    await screen.findByRole('heading', { level: 1, name: 'Welcome to Beekeeper' })

    openAbout()
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('heading', { level: 1, name: 'Welcome to Beekeeper' })).toBeTruthy()
  })
})
