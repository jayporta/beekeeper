import type { IncomingMessage } from 'node:http'
import { Readable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { readLimitedBody } from '../readLimitedBody'

function bodyOf(...chunks: (string | Error)[]): IncomingMessage {
  return Readable.from(
    (async function* () {
      for (const chunk of chunks) {
        if (chunk instanceof Error) throw chunk
        yield Buffer.from(chunk)
      }
    })()
  ) as unknown as IncomingMessage
}

describe('readLimitedBody', () => {
  it('joins the chunks into text', async () => {
    expect(await readLimitedBody(bodyOf('{"a":', '1}'), 100)).toEqual({ ok: true, text: '{"a":1}' })
  })

  it('reads an empty body as empty text', async () => {
    expect(await readLimitedBody(bodyOf(), 100)).toEqual({ ok: true, text: '' })
  })

  it('accepts a body of exactly the cap', async () => {
    expect(await readLimitedBody(bodyOf('abcde'), 5)).toEqual({ ok: true, text: 'abcde' })
  })

  it('rejects a body one byte over the cap', async () => {
    expect(await readLimitedBody(bodyOf('abcdef'), 5)).toEqual({ ok: false, reason: 'too-large' })
  })

  it('rejects a body that passes the cap across several chunks', async () => {
    expect(await readLimitedBody(bodyOf('abc', 'def'), 5)).toEqual({
      ok: false,
      reason: 'too-large'
    })
  })

  it('counts bytes, not characters', async () => {
    expect(await readLimitedBody(bodyOf('éé'), 3)).toEqual({ ok: false, reason: 'too-large' })
  })

  it('reports a stream error as aborted', async () => {
    expect(await readLimitedBody(bodyOf('ab', new Error('reset')), 100)).toEqual({
      ok: false,
      reason: 'aborted'
    })
  })
})
