import { describe, expect, it } from 'vitest'
import { changedFolder } from '../changedFolder'

describe('changedFolder', () => {
  it('maps a file in a project folder to that folder', () => {
    expect(changedFolder('-Users-a/abc.jsonl')).toEqual({
      kind: 'folder',
      dirName: '-Users-a',
      isFolderItself: false
    })
  })

  it('marks an event on the folder itself', () => {
    expect(changedFolder('-Users-a')).toEqual({
      kind: 'folder',
      dirName: '-Users-a',
      isFolderItself: true
    })
  })

  it('maps a nested subagent path to its project folder', () => {
    expect(changedFolder('-Users-a/session-1/subagents/agent-x.jsonl')).toEqual({
      kind: 'folder',
      dirName: '-Users-a',
      isFolderItself: false
    })
  })

  it('splits on a backslash as well as a slash', () => {
    expect(changedFolder('-Users-a\\abc.jsonl')).toEqual({
      kind: 'folder',
      dirName: '-Users-a',
      isFolderItself: false
    })
  })

  it('ignores empty segments', () => {
    expect(changedFolder('/-Users-a//abc.jsonl')).toEqual({
      kind: 'folder',
      dirName: '-Users-a',
      isFolderItself: false
    })
  })

  it('treats a trailing separator as the folder itself', () => {
    expect(changedFolder('-Users-a/')).toEqual({
      kind: 'folder',
      dirName: '-Users-a',
      isFolderItself: true
    })
  })

  it.each([
    ['a hidden file at the root', '.DS_Store'],
    ['something inside a hidden folder at the root', '.DS_Store/x'],
    ['a hidden editor file at the root', '.swp']
  ])('ignores %s', (_label, filename) => {
    expect(changedFolder(filename)).toEqual({ kind: 'ignored' })
  })

  it('still maps a hidden file inside a project folder to that folder', () => {
    expect(changedFolder('-Users-a/.hidden')).toEqual({
      kind: 'folder',
      dirName: '-Users-a',
      isFolderItself: false
    })
  })

  it.each([
    ['null', null],
    ['an empty string', ''],
    ['only separators', '//'],
    ['dot-dot', '..'],
    ['dot-dot with a child', '../x'],
    ['dot', '.'],
    ['an overlong first segment', 'a'.repeat(256)],
    ['a NUL in the first segment', 'a\0b/c.jsonl']
  ])('reports unknown for %s', (_label, filename) => {
    expect(changedFolder(filename)).toEqual({ kind: 'unknown' })
  })

  it('accepts a first segment of exactly 255 characters', () => {
    const dirName = 'a'.repeat(255)
    expect(changedFolder(`${dirName}/x`)).toEqual({
      kind: 'folder',
      dirName,
      isFolderItself: false
    })
  })
})
