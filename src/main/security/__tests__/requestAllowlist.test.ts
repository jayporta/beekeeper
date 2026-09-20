import { describe, expect, it } from 'vitest'
import { isAllowedRequestUrl, isDevServerUrl } from '../requestAllowlist'

const RENDERER_ROOT = '/apps/beekeeper/out/renderer'
const DEV_SERVER_URL = 'http://localhost:5173'

describe('isDevServerUrl', () => {
  it('matches the dev server origin', () => {
    expect(isDevServerUrl('http://localhost:5173/src/main.tsx', DEV_SERVER_URL)).toBe(true)
  })

  it('treats the websocket scheme as equivalent to its http counterpart', () => {
    expect(isDevServerUrl('ws://localhost:5173/', DEV_SERVER_URL)).toBe(true)
  })

  it('rejects a hostname that merely starts with the dev server origin as a string', () => {
    expect(isDevServerUrl('http://localhost:5173.evil.com/', DEV_SERVER_URL)).toBe(false)
  })

  it('rejects a userinfo trick that pushes the real host past an @', () => {
    expect(isDevServerUrl('http://localhost:5173@evil.com/', DEV_SERVER_URL)).toBe(false)
  })

  it('rejects https when the dev server is http', () => {
    expect(isDevServerUrl('https://localhost:5173/', DEV_SERVER_URL)).toBe(false)
  })

  it('returns false when there is no dev server', () => {
    expect(isDevServerUrl('http://localhost:5173/', undefined)).toBe(false)
  })

  it('returns false for a malformed URL', () => {
    expect(isDevServerUrl('not a url', DEV_SERVER_URL)).toBe(false)
  })
})

describe('isAllowedRequestUrl', () => {
  it('allows a file inside the renderer root', () => {
    const url = `file://${RENDERER_ROOT}/index.html`

    expect(isAllowedRequestUrl(url, { rendererRoot: RENDERER_ROOT, devServerUrl: undefined })).toBe(
      true
    )
  })

  it('denies a file in a sibling directory', () => {
    const url = 'file:///apps/beekeeper/out/main/index.js'

    expect(isAllowedRequestUrl(url, { rendererRoot: RENDERER_ROOT, devServerUrl: undefined })).toBe(
      false
    )
  })

  it('denies a traversal out of the renderer root', () => {
    const url = `file://${RENDERER_ROOT}/../../etc/passwd`

    expect(isAllowedRequestUrl(url, { rendererRoot: RENDERER_ROOT, devServerUrl: undefined })).toBe(
      false
    )
  })

  it('denies an absolute path outside the renderer root', () => {
    const url = 'file:///etc/passwd'

    expect(isAllowedRequestUrl(url, { rendererRoot: RENDERER_ROOT, devServerUrl: undefined })).toBe(
      false
    )
  })

  it('allows a percent-encoded path inside the renderer root', () => {
    const url = `file://${RENDERER_ROOT}/some%20file.html`

    expect(isAllowedRequestUrl(url, { rendererRoot: RENDERER_ROOT, devServerUrl: undefined })).toBe(
      true
    )
  })

  it('denies an external host when there is no dev server', () => {
    const options = { rendererRoot: RENDERER_ROOT, devServerUrl: undefined }

    expect(isAllowedRequestUrl('https://example.com', options)).toBe(false)
  })

  it('allows the dev server origin over http and its websocket', () => {
    const options = { rendererRoot: RENDERER_ROOT, devServerUrl: DEV_SERVER_URL }

    expect(isAllowedRequestUrl('http://localhost:5173/src/main.tsx', options)).toBe(true)
    expect(isAllowedRequestUrl('ws://localhost:5173/', options)).toBe(true)
  })

  it('denies a different host even while a dev server is running', () => {
    const options = { rendererRoot: RENDERER_ROOT, devServerUrl: DEV_SERVER_URL }

    expect(isAllowedRequestUrl('https://example.com', options)).toBe(false)
  })

  it('denies a malformed URL', () => {
    const options = { rendererRoot: RENDERER_ROOT, devServerUrl: undefined }

    expect(isAllowedRequestUrl('not a url', options)).toBe(false)
  })

  it('allows the devtools scheme only while a dev server is running', () => {
    const devtoolsUrl = 'devtools://devtools/bundled/devtools_app.html'

    expect(
      isAllowedRequestUrl(devtoolsUrl, {
        rendererRoot: RENDERER_ROOT,
        devServerUrl: DEV_SERVER_URL
      })
    ).toBe(true)
    expect(
      isAllowedRequestUrl(devtoolsUrl, { rendererRoot: RENDERER_ROOT, devServerUrl: undefined })
    ).toBe(false)
  })
})
