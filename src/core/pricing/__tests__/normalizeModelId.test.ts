import { describe, expect, it } from 'vitest'
import { normalizeModelId } from '../normalizeModelId'

describe('normalizeModelId', () => {
  it('strips a trailing bracketed suffix', () => {
    expect(normalizeModelId('claude-opus-5[1m]')).toBe('claude-opus-5')
  })

  it('strips a trailing date suffix', () => {
    expect(normalizeModelId('claude-haiku-4-5-20260101')).toBe('claude-haiku-4-5')
  })

  it('strips both a date and a bracketed suffix', () => {
    expect(normalizeModelId('claude-opus-5-20260101[1m]')).toBe('claude-opus-5')
  })

  it('leaves an id with neither suffix unchanged', () => {
    expect(normalizeModelId('claude-sonnet-5')).toBe('claude-sonnet-5')
  })

  it('leaves a version-numbered id unchanged', () => {
    expect(normalizeModelId('claude-opus-4-7')).toBe('claude-opus-4-7')
  })

  it.each(['claude-x-2026010', 'claude-x-202601011'])(
    'leaves a digit suffix that is not exactly 8 digits unchanged (%s)',
    (id) => {
      expect(normalizeModelId(id)).toBe(id)
    }
  )

  it('leaves the synthetic placeholder model unchanged', () => {
    expect(normalizeModelId('<synthetic>')).toBe('<synthetic>')
  })
})
