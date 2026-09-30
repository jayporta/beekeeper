import type { WebContents } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import { hardenWebContents } from '../windowSecurity'

type NavigateHandler = (event: { preventDefault: () => void }, url: string) => void

/** A minimal stand-in for `WebContents` that records the handlers `hardenWebContents` registers. */
function fakeWebContents(currentUrl: string): {
  webContents: WebContents
  navigate: (url: string) => boolean
} {
  let onNavigate: NavigateHandler | undefined
  const webContents = {
    getURL: () => currentUrl,
    setWindowOpenHandler: vi.fn(),
    on: vi.fn((event: string, handler: NavigateHandler) => {
      if (event === 'will-navigate') onNavigate = handler
    })
  } as unknown as WebContents

  return {
    webContents,
    /** Fires `will-navigate` and reports whether it was cancelled. */
    navigate(url) {
      const preventDefault = vi.fn()
      onNavigate?.({ preventDefault }, url)
      return preventDefault.mock.calls.length > 0
    }
  }
}

const APP_PAGE = 'file:///app/out/renderer/index.html'

describe('hardenWebContents will-navigate', () => {
  it('allows a navigation to the page the window already shows, such as a reload', () => {
    const { webContents, navigate } = fakeWebContents(APP_PAGE)
    hardenWebContents(webContents, undefined)

    expect(navigate(APP_PAGE)).toBe(false)
  })

  it('blocks a navigation to any other page', () => {
    const { webContents, navigate } = fakeWebContents(APP_PAGE)
    hardenWebContents(webContents, undefined)

    expect(navigate('https://example.com/')).toBe(true)
    expect(navigate('file:///etc/passwd')).toBe(true)
  })

  it('does not treat a same-path URL with a different query or fragment as the same page', () => {
    const { webContents, navigate } = fakeWebContents(APP_PAGE)
    hardenWebContents(webContents, undefined)

    expect(navigate(`${APP_PAGE}?next=1`)).toBe(true)
    expect(navigate(`${APP_PAGE}#next`)).toBe(true)
  })

  it('allows the dev server in development', () => {
    const { webContents, navigate } = fakeWebContents('http://localhost:5173/')
    hardenWebContents(webContents, 'http://localhost:5173')

    expect(navigate('http://localhost:5173/some/page')).toBe(false)
  })

  it('blocks the dev server origin when there is no dev server, as in production', () => {
    const { webContents, navigate } = fakeWebContents(APP_PAGE)
    hardenWebContents(webContents, undefined)

    expect(navigate('http://localhost:5173/')).toBe(true)
  })
})

describe('hardenWebContents other guards', () => {
  it('denies every popup', () => {
    const { webContents } = fakeWebContents(APP_PAGE)
    hardenWebContents(webContents, undefined)

    const handler = vi.mocked(webContents.setWindowOpenHandler).mock.calls[0]?.[0]
    expect(handler?.({} as never)).toEqual({ action: 'deny' })
  })
})
