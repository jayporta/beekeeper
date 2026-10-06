import { describe, expect, it } from 'vitest'
import { mergeFirstRunState } from '../state/mergeFirstRunState'

const current = { dismissed: false, dismiss: () => undefined }

describe('mergeFirstRunState', () => {
  it('takes a stored boolean dismissed', () => {
    expect(mergeFirstRunState({ dismissed: true }, current).dismissed).toBe(true)
    expect(
      mergeFirstRunState({ dismissed: false }, { ...current, dismissed: true }).dismissed
    ).toBe(false)
  })

  it.each([
    ['the string "false"', 'false'],
    ['the string "true"', 'true'],
    ['a number', 1],
    ['null', null],
    ['an object', {}]
  ])('ignores a dismissed that is %s and keeps the current value', (_label, dismissed) => {
    expect(mergeFirstRunState({ dismissed }, current).dismissed).toBe(false)
  })

  it('does not let a stored value overwrite an action', () => {
    const merged = mergeFirstRunState({ dismissed: true, dismiss: 'x' }, current)

    expect(merged.dismiss).toBe(current.dismiss)
  })

  it.each([
    ['nothing stored', undefined],
    ['null', null],
    ['a string', 'dismissed'],
    ['an array', [true]]
  ])('keeps the current state when the stored value is %s', (_label, persisted) => {
    expect(mergeFirstRunState(persisted, current)).toEqual(current)
  })
})
