import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { resetFirstRun } from '@renderer/features/firstRun/testFirstRunReset'
import App from '../App'

afterEach(resetFirstRun)

describe('App', () => {
  it('has a sidebar landmark and a main landmark', async () => {
    render(<App />)

    expect(screen.getByRole('complementary', { name: 'Sidebar' })).toBeTruthy()
    expect(screen.getByRole('main')).toBeTruthy()
    await screen.findByRole('heading', { level: 1 })
  })
})
