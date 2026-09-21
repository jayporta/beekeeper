import { describe, expect, it } from 'vitest'
import type { Usage } from '../../transcript/schemas'
import { messageTokens } from '../messageTokens'

describe('messageTokens', () => {
  it('reads every field from the top-level snapshot when there are no iterations', () => {
    const usage: Usage = {
      input_tokens: 100,
      output_tokens: 50,
      cache_read_input_tokens: 20,
      cache_creation: { ephemeral_5m_input_tokens: 10, ephemeral_1h_input_tokens: 5 }
    }

    expect(messageTokens(usage)).toEqual({
      input: 100,
      output: 50,
      cacheRead: 20,
      cacheWrite5m: 10,
      cacheWrite1h: 5
    })
  })

  it('defaults missing optional fields to zero', () => {
    const usage: Usage = { input_tokens: 1, output_tokens: 2 }

    expect(messageTokens(usage)).toEqual({
      input: 1,
      output: 2,
      cacheRead: 0,
      cacheWrite5m: 0,
      cacheWrite1h: 0
    })
  })

  it('sums iterations when there are more than one', () => {
    const usage: Usage = {
      input_tokens: 999,
      output_tokens: 999,
      iterations: [
        { input_tokens: 10, output_tokens: 5 },
        { input_tokens: 20, output_tokens: 15 }
      ]
    }

    expect(messageTokens(usage)).toEqual({
      input: 30,
      output: 20,
      cacheRead: 0,
      cacheWrite5m: 0,
      cacheWrite1h: 0
    })
  })

  it('uses the top-level snapshot when there is exactly one iteration', () => {
    const usage: Usage = {
      input_tokens: 7,
      output_tokens: 3,
      iterations: [{ input_tokens: 999, output_tokens: 999 }]
    }

    expect(messageTokens(usage)).toEqual({
      input: 7,
      output: 3,
      cacheRead: 0,
      cacheWrite5m: 0,
      cacheWrite1h: 0
    })
  })

  it('tolerates a null iterations field and uses the top-level snapshot', () => {
    const usage: Usage = { input_tokens: 4, output_tokens: 6, iterations: null }

    expect(messageTokens(usage)).toEqual({
      input: 4,
      output: 6,
      cacheRead: 0,
      cacheWrite5m: 0,
      cacheWrite1h: 0
    })
  })

  it('credits an unsplit cache-write total entirely to the 5-minute class', () => {
    const usage: Usage = { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 42 }

    expect(messageTokens(usage)).toEqual({
      input: 1,
      output: 1,
      cacheRead: 0,
      cacheWrite5m: 42,
      cacheWrite1h: 0
    })
  })
})
