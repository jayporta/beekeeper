import { describe, expect, it } from 'vitest'
import { UNKNOWN_SPEED, usageSchema } from '../schemas/usage'

describe('usageSchema', () => {
  it('accepts a null iterations field, as a synthetic record carries', () => {
    const usage = { input_tokens: 0, output_tokens: 0, iterations: null }

    expect(usageSchema.safeParse(usage).success).toBe(true)
  })

  it('accepts a missing iterations field', () => {
    const usage = { input_tokens: 1, output_tokens: 1 }

    expect(usageSchema.safeParse(usage).success).toBe(true)
  })

  it('rejects a negative input_tokens count', () => {
    const usage = { input_tokens: -1, output_tokens: 1 }

    expect(usageSchema.safeParse(usage).success).toBe(false)
  })

  it('rejects a negative count inside cache_creation', () => {
    const usage = {
      input_tokens: 1,
      output_tokens: 1,
      cache_creation: { ephemeral_5m_input_tokens: -5 }
    }

    expect(usageSchema.safeParse(usage).success).toBe(false)
  })

  it('rejects a negative count inside an iteration entry', () => {
    const usage = {
      input_tokens: 1,
      output_tokens: 1,
      iterations: [{ input_tokens: 1, output_tokens: -2 }]
    }

    expect(usageSchema.safeParse(usage).success).toBe(false)
  })

  it('narrows an absent speed to undefined', () => {
    const result = usageSchema.safeParse({ input_tokens: 1, output_tokens: 1 })

    expect(result.success && result.data.speed).toBeUndefined()
  })

  it('narrows a null speed to undefined', () => {
    const result = usageSchema.safeParse({ input_tokens: 1, output_tokens: 1, speed: null })

    expect(result.success && result.data.speed).toBeUndefined()
  })

  it('keeps a short speed string unchanged', () => {
    const result = usageSchema.safeParse({ input_tokens: 1, output_tokens: 1, speed: 'standard' })

    expect(result.success && result.data.speed).toBe('standard')
  })

  it('narrows an oversized speed string to the unknown sentinel', () => {
    const result = usageSchema.safeParse({
      input_tokens: 1,
      output_tokens: 1,
      speed: 'x'.repeat(33)
    })

    expect(result.success && result.data.speed).toBe(UNKNOWN_SPEED)
  })

  it('narrows a non-string speed (an object) to the unknown sentinel', () => {
    const result = usageSchema.safeParse({
      input_tokens: 1,
      output_tokens: 1,
      speed: { nested: 'json' }
    })

    expect(result.success && result.data.speed).toBe(UNKNOWN_SPEED)
  })
})
