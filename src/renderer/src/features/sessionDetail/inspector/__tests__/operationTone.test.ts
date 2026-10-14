import { describe, expect, it } from 'vitest'
import { operationTone } from '../operationTone'

describe('operationTone', () => {
  it.each([
    ['create', 'success'],
    ['edit', 'edit'],
    ['update', 'edit'],
    ['delete', 'error'],
    ['change', 'neutral']
  ] as const)('gives %s the %s tone', (operation, tone) => {
    expect(operationTone(operation)).toBe(tone)
  })
})
