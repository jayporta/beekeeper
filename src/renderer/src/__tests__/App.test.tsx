import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { installBeekeeperApi } from '../testBeekeeperApi'
import { renderApp, resetPersistedState } from '../testRenderApp'

beforeEach(() => {
  installBeekeeperApi()
})

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
})
