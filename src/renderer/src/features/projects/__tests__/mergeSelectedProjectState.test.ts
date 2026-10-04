import { describe, expect, it } from 'vitest'
import { mergeSelectedProjectState } from '../state/mergeSelectedProjectState'

const current = {
  selectedDirName: null as string | null,
  goneDirName: null as string | null,
  select: () => undefined,
  forgetGoneFolder: () => undefined
}

describe('mergeSelectedProjectState', () => {
  it('takes a stored folder name', () => {
    expect(mergeSelectedProjectState({ selectedDirName: '-Users-a-beta' }, current)).toEqual({
      ...current,
      selectedDirName: '-Users-a-beta'
    })
  })

  it('takes a stored null, clearing the current selection', () => {
    const merged = mergeSelectedProjectState(
      { selectedDirName: null },
      { ...current, selectedDirName: '-Users-a-alpha' }
    )

    expect(merged.selectedDirName).toBeNull()
  })

  it.each([
    ['a number', 1],
    ['a boolean', true],
    ['an object', {}],
    ['an array', ['-Users-a-beta']],
    ['undefined', undefined]
  ])('ignores a selectedDirName that is %s and keeps the current value', (_label, stored) => {
    const merged = mergeSelectedProjectState(
      { selectedDirName: stored },
      { ...current, selectedDirName: '-Users-a-alpha' }
    )

    expect(merged.selectedDirName).toBe('-Users-a-alpha')
  })

  it('keeps the actions from the current state', () => {
    const merged = mergeSelectedProjectState(
      { selectedDirName: '-Users-a-beta', select: 'x', forgetGoneFolder: 5 },
      current
    )

    expect(merged.select).toBe(current.select)
    expect(merged.forgetGoneFolder).toBe(current.forgetGoneFolder)
  })

  it('never restores a stored missing folder', () => {
    const merged = mergeSelectedProjectState(
      { selectedDirName: '-Users-a-beta', goneDirName: '-Users-a-alpha' },
      current
    )

    expect(merged.goneDirName).toBeNull()
  })

  it.each([
    ['nothing stored', undefined],
    ['null', null],
    ['a string', 'selectedDirName'],
    ['an array', ['-Users-a-beta']]
  ])('keeps the current state when the stored value is %s', (_label, persisted) => {
    expect(mergeSelectedProjectState(persisted, current)).toEqual(current)
  })
})
