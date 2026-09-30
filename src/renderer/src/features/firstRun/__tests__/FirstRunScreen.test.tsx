import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FirstRunScreen } from '../FirstRunScreen'

afterEach(() => {
  vi.restoreAllMocks()
})

const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/152'
const LINUX = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/152'

describe('FirstRunScreen macOS section', () => {
  it('explains the folder access prompt on macOS', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(MAC)

    render(<FirstRunScreen />)

    expect(
      screen.getByRole('heading', { level: 2, name: 'Why macOS may ask for folder access' })
    ).toBeTruthy()
  })

  it('leaves it out on other platforms, but keeps the other sections', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(LINUX)

    render(<FirstRunScreen />)

    expect(screen.queryByRole('heading', { name: /macOS/ })).toBeNull()
    expect(screen.getByRole('heading', { level: 2, name: 'What Beekeeper reads' })).toBeTruthy()
    expect(
      screen.getByRole('heading', { level: 2, name: 'Nothing leaves your computer' })
    ).toBeTruthy()
  })
})
