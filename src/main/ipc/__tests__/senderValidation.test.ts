import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isTrustedSender, type SenderEvent } from '../senderValidation'
import { TEST_INDEX_URL, TEST_ORIGINS, TEST_RENDERER_ROOT } from '../testSender'

const rendererRoot = TEST_RENDERER_ROOT
const indexUrl = TEST_INDEX_URL
const origins = TEST_ORIGINS

function mainFrame(url: string): SenderEvent {
  return { senderFrame: { url, parent: null } }
}

describe('isTrustedSender', () => {
  it('trusts the main frame on the bundled index.html', () => {
    expect(isTrustedSender(mainFrame(indexUrl), origins)).toBe(true)
  })

  it('trusts the bundled index.html with a hash route', () => {
    expect(isTrustedSender(mainFrame(`${indexUrl}#/session/1`), origins)).toBe(true)
  })

  it('refuses a null sender frame', () => {
    expect(isTrustedSender({ senderFrame: null }, origins)).toBe(false)
  })

  it('refuses a subframe on the bundled page', () => {
    const event: SenderEvent = { senderFrame: { url: indexUrl, parent: {} } }
    expect(isTrustedSender(event, origins)).toBe(false)
  })

  it.each([
    ['a foreign https page', 'https://example.com/index.html'],
    ['another bundled file', pathToFileURL(join(rendererRoot, 'assets', 'x.html')).href],
    ['a file outside the root', pathToFileURL('/etc/passwd').href],
    ['a traversal out of the root', `${indexUrl}/../../../secret.html`],
    ['garbage', 'not a url']
  ])('refuses %s', (_label, url) => {
    expect(isTrustedSender(mainFrame(url), origins)).toBe(false)
  })

  it('refuses the dev server when none is configured', () => {
    expect(isTrustedSender(mainFrame('http://localhost:5173/'), origins)).toBe(false)
  })

  it('trusts the dev server origin in development', () => {
    const dev = { rendererRoot, devServerUrl: 'http://localhost:5173' }
    expect(isTrustedSender(mainFrame('http://localhost:5173/'), dev)).toBe(true)
  })

  it('refuses a lookalike of the dev server origin', () => {
    const dev = { rendererRoot, devServerUrl: 'http://localhost:5173' }
    expect(isTrustedSender(mainFrame('http://localhost:5173.evil.com/'), dev)).toBe(false)
  })
})
