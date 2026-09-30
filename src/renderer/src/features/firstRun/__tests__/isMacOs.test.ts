import { afterEach, describe, expect, it, vi } from 'vitest'
import { isMacOS } from '../isMacOs'

afterEach(() => {
  vi.restoreAllMocks()
})

const withUserAgent = (userAgent: string): void => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent)
}

describe('isMacOS', () => {
  it('is true for the user agent Electron reports on macOS', () => {
    withUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/152')

    expect(isMacOS()).toBe(true)
  })

  it.each([
    ['Linux', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/152'],
    ['Windows', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152']
  ])('is false for %s', (_name, userAgent) => {
    withUserAgent(userAgent)

    expect(isMacOS()).toBe(false)
  })
})
