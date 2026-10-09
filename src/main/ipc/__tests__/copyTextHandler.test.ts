import { describe, expect, it } from 'vitest'
import { copyTextHandler } from '../copyTextHandler'

function recorder(): { written: string[]; deps: Parameters<typeof copyTextHandler>[0] } {
  const written: string[] = []
  return { written, deps: { copyToClipboard: (text) => written.push(text) } }
}

describe('copyTextHandler', () => {
  it('writes the text to the clipboard', async () => {
    const { written, deps } = recorder()

    const result = await copyTextHandler(deps, { text: 'KEY=value' })

    expect([result, written]).toEqual([{ ok: true, value: null }, ['KEY=value']])
  })

  it('writes text of exactly the cap', async () => {
    const { written, deps } = recorder()

    await copyTextHandler(deps, { text: 'x'.repeat(4096) })

    expect(written).toHaveLength(1)
  })

  it('writes an empty string', async () => {
    const { written, deps } = recorder()

    await copyTextHandler(deps, { text: '' })

    expect(written).toEqual([''])
  })

  it.each([
    ['no payload', undefined],
    ['no text', {}],
    ['a number', { text: 1 }],
    ['text one past the cap', { text: 'x'.repeat(4097) }],
    ['an extra field', { text: 'a', html: '<b>' }]
  ])('refuses %s without touching the clipboard', async (_label, payload) => {
    const { written, deps } = recorder()

    const result = await copyTextHandler(deps, payload)

    expect([result, written]).toEqual([{ ok: false, error: { code: 'invalid-request' } }, []])
  })

  it('fails with an internal error when the app set up no clipboard', async () => {
    expect(await copyTextHandler({ copyToClipboard: null }, { text: 'a' })).toEqual({
      ok: false,
      error: { code: 'internal' }
    })
  })
})
