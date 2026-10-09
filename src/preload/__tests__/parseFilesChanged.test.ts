import { describe, expect, it } from 'vitest'
import { MAX_CHANGED_DIR_NAME_LENGTH, MAX_CHANGED_FOLDERS } from '../../shared/ipc/filesChangedDto'
import { MAX_PROJECT_DIR_NAME_LENGTH } from '../../shared/ipc/requestSchemas'
import { parseFilesChanged } from '../parseFilesChanged'

const valid = { dirNames: ['-Users-a-repo', '-Users-b-repo'], foldersChanged: false, all: false }

describe('parseFilesChanged', () => {
  it('returns a valid payload unchanged', () => {
    expect(parseFilesChanged(valid)).toEqual(valid)
  })

  it('accepts a batch that is all with no folder names', () => {
    const change = { dirNames: [], foldersChanged: true, all: true }
    expect(parseFilesChanged(change)).toEqual(change)
  })

  it('accepts a name of exactly the longest allowed length', () => {
    const dirNames = ['a'.repeat(MAX_CHANGED_DIR_NAME_LENGTH)]
    expect(parseFilesChanged({ ...valid, dirNames })).not.toBeNull()
  })

  it('accepts exactly the largest allowed number of names', () => {
    const dirNames = Array.from({ length: MAX_CHANGED_FOLDERS }, (_, i) => `folder-${i}`)
    expect(parseFilesChanged({ ...valid, dirNames })).not.toBeNull()
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'files'],
    ['an array', []],
    ['a missing dirNames', { foldersChanged: false, all: false }],
    ['a missing foldersChanged', { dirNames: [], all: false }],
    ['a missing all', { dirNames: [], foldersChanged: false }],
    ['an extra field', { ...valid, extra: 1 }],
    ['a non-boolean flag', { ...valid, all: 'yes' }],
    ['a name with a slash', { ...valid, dirNames: ['a/b'] }],
    ['a name with a backslash', { ...valid, dirNames: ['a\\b'] }],
    ['a name with NUL', { ...valid, dirNames: ['a\0b'] }],
    ['a dot name', { ...valid, dirNames: ['.'] }],
    ['an overlong name', { ...valid, dirNames: ['a'.repeat(MAX_CHANGED_DIR_NAME_LENGTH + 1)] }],
    ['dirNames that is not an array', { ...valid, dirNames: 'a' }],
    ['a dot-dot name', { ...valid, dirNames: ['..'] }],
    ['an empty name', { ...valid, dirNames: [''] }],
    ['a non-string name', { ...valid, dirNames: [1] }],
    [
      'too many names',
      { ...valid, dirNames: Array.from({ length: MAX_CHANGED_FOLDERS + 1 }, (_, i) => `f-${i}`) }
    ]
  ])('returns null for %s', (_label, payload) => {
    expect(parseFilesChanged(payload)).toBeNull()
  })
})

describe('MAX_CHANGED_DIR_NAME_LENGTH', () => {
  it('matches the longest name a request may carry', () => {
    expect(MAX_CHANGED_DIR_NAME_LENGTH).toBe(MAX_PROJECT_DIR_NAME_LENGTH)
  })
})
