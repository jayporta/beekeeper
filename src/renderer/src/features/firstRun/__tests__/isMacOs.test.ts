import { afterEach, describe, expect, it, vi } from 'vitest'
import { isMacOS } from '../isMacOs'
import {
  LINUX_USER_AGENT,
  MAC_USER_AGENT,
  stubUserAgent,
  WINDOWS_USER_AGENT
} from '../testUserAgents'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('isMacOS', () => {
  it('is true for the user agent Electron reports on macOS', () => {
    stubUserAgent(MAC_USER_AGENT)

    expect(isMacOS()).toBe(true)
  })

  it.each([
    ['Linux', LINUX_USER_AGENT],
    ['Windows', WINDOWS_USER_AGENT]
  ])('is false for %s', (_name, userAgent) => {
    stubUserAgent(userAgent)

    expect(isMacOS()).toBe(false)
  })
})
