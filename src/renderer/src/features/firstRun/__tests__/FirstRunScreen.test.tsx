import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FirstRunScreen } from '../FirstRunScreen'
import { LINUX_USER_AGENT, MAC_USER_AGENT, stubUserAgent } from '../testUserAgents'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('FirstRunScreen macOS section', () => {
  it('explains the folder access prompt on macOS', () => {
    stubUserAgent(MAC_USER_AGENT)

    render(<FirstRunScreen />)

    expect(
      screen.getByRole('heading', { level: 2, name: 'Why macOS may ask for folder access' })
    ).toBeTruthy()
  })

  it('leaves it out on other platforms, but keeps the other sections', () => {
    stubUserAgent(LINUX_USER_AGENT)

    render(<FirstRunScreen />)

    expect(screen.queryByRole('heading', { name: /macOS/ })).toBeNull()
    expect(screen.getByRole('heading', { level: 2, name: 'What Beekeeper reads' })).toBeTruthy()
    expect(
      screen.getByRole('heading', { level: 2, name: 'Nothing leaves your computer' })
    ).toBeTruthy()
  })
})
