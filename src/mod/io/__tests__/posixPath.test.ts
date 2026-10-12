import { posix } from 'node:path'
import { describe, expect, it } from 'vitest'
import { joinPath, resolvePath } from '../posixPath'

const CWD = '/work/repo'

describe('joinPath', () => {
  it('folds dot segments', () => {
    expect(joinPath('/a', 'b/../c')).toBe('/a/c')
  })

  it('skips empty segments', () => {
    expect(joinPath('a', '')).toBe('a')
  })

  it('answers a dot when nothing is left', () => {
    expect(joinPath()).toBe('.')
  })

  it('matches node:path/posix over a table of inputs', () => {
    const table: string[][] = [
      ['/'],
      ['/', 'a'],
      ['a', 'b'],
      ['a/', 'b/'],
      ['/a//b', './c'],
      ['..', 'a'],
      ['a', '../../b'],
      ['/a', '../..', 'b'],
      ['', ''],
      ['./'],
      ['/a/b/', '..']
    ]
    for (const segments of table) {
      expect(joinPath(...segments), JSON.stringify(segments)).toBe(posix.join(...segments))
    }
  })
})

describe('resolvePath', () => {
  it('folds dot segments in an absolute path', () => {
    expect(resolvePath('/a/b/..', CWD)).toBe('/a')
  })

  it('resolves a relative path against the working directory', () => {
    expect(resolvePath('x', CWD)).toBe('/work/repo/x')
  })

  it('keeps the root', () => {
    expect(resolvePath('/', CWD)).toBe('/')
  })

  it('answers the working directory for an empty path', () => {
    expect(resolvePath('', CWD)).toBe(CWD)
  })

  it('matches node:path/posix over a table of inputs', () => {
    const table = ['/a/b/', 'x/../y', '../z', '/..', '/a//b', './', '..', '/a/./b/../c/']
    for (const path of table) {
      expect(resolvePath(path, CWD), path).toBe(posix.resolve(CWD, path))
    }
  })
})
