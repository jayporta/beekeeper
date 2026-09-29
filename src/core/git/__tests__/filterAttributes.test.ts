import { describe, expect, it } from 'vitest'
import { toGitBinary } from '../gitBinary'
import {
  assignsFilter,
  batchPaths,
  CHECK_ATTR_BATCH_SIZE,
  parseFilterAttributes,
  pathsAssignFilters
} from '../filterAttributes'
import type { GitExecFn } from '../runGit'

/** Builds `git check-attr -z filter` output for the given path and value pairs. */
function output(...records: readonly (readonly [string, string])[]): Buffer {
  return Buffer.from(records.map(([path, value]) => `${path}\0filter\0${value}\0`).join(''))
}

describe('batchPaths', () => {
  it('splits paths into consecutive batches of the given size', () => {
    expect(batchPaths(['a', 'b', 'c', 'd', 'e', 'f', 'g'], 3)).toEqual([
      ['a', 'b', 'c'],
      ['d', 'e', 'f'],
      ['g']
    ])
  })

  it('returns no batches for no paths', () => {
    expect(batchPaths([])).toEqual([])
  })

  it('splits past the default batch size', () => {
    const paths = Array.from({ length: CHECK_ATTR_BATCH_SIZE + 1 }, (_, n) => `p${n}`)

    expect(batchPaths(paths).map((batch) => batch.length)).toEqual([CHECK_ATTR_BATCH_SIZE, 1])
  })

  it('keeps a batch exactly at the size whole', () => {
    const paths = Array.from({ length: CHECK_ATTR_BATCH_SIZE }, (_, n) => `p${n}`)

    expect(batchPaths(paths)).toHaveLength(1)
  })
})

describe('parseFilterAttributes', () => {
  it.each(['unspecified', 'unset', 'set', 'lfs'])('reads the value %s', (value) => {
    expect(parseFilterAttributes(output(['a.bin', value]))).toEqual({
      ok: true,
      value: [{ path: 'a.bin', value }]
    })
  })

  it('reads several records in order, with a path holding a space or newline', () => {
    const result = parseFilterAttributes(output(['a b.bin', 'lfs'], ['c\nd', 'unspecified']))

    expect(result).toEqual({
      ok: true,
      value: [
        { path: 'a b.bin', value: 'lfs' },
        { path: 'c\nd', value: 'unspecified' }
      ]
    })
  })

  it('reads empty output as no entries', () => {
    expect(parseFilterAttributes(Buffer.from(''))).toEqual({ ok: true, value: [] })
  })

  it.each([
    ['a truncated record', Buffer.from('a.bin\0filter\0')],
    ['a missing final terminator', Buffer.from('a.bin\0filter\0lfs')],
    ['another attribute', Buffer.from('a.bin\0text\0set\0')]
  ])('rejects %s', (_name, bytes) => {
    expect(parseFilterAttributes(bytes)).toEqual({ ok: false, error: 'malformed-check-attr' })
  })
})

describe('pathsAssignFilters', () => {
  const git = toGitBinary('/fake/git')

  /** A git exec that records how often it ran and answers every call with the given outcome. */
  function fakeExec(outcome: () => Promise<{ stdout: Buffer }>): {
    readonly exec: GitExecFn
    readonly calls: () => number
  } {
    let calls = 0
    return {
      exec: () => {
        calls += 1
        return outcome()
      },
      calls: () => calls
    }
  }

  it('returns without running git when there are no paths', async () => {
    const fake = fakeExec(() => Promise.resolve({ stdout: Buffer.from('') }))

    const result = await pathsAssignFilters({ git, dir: '/wt', paths: [], exec: fake.exec })

    expect({ result, calls: fake.calls() }).toEqual({
      result: { ok: true, value: false },
      calls: 0
    })
  })

  it('counts a path with an invalid UTF-8 byte as assigned without running git', async () => {
    const fake = fakeExec(() => Promise.resolve({ stdout: Buffer.from('') }))

    const result = await pathsAssignFilters({
      git,
      dir: '/wt',
      paths: ['ok.txt', 'bad�.txt'],
      exec: fake.exec
    })

    expect({ result, calls: fake.calls() }).toEqual({ result: { ok: true, value: true }, calls: 0 })
  })

  it('counts more paths than the cap as assigned without running git', async () => {
    const fake = fakeExec(() => Promise.resolve({ stdout: Buffer.from('') }))

    const result = await pathsAssignFilters({
      git,
      dir: '/wt',
      paths: ['a', 'b', 'c'],
      maxPaths: 2,
      exec: fake.exec
    })

    expect({ result, calls: fake.calls() }).toEqual({ result: { ok: true, value: true }, calls: 0 })
  })

  it('checks paths up to the cap', async () => {
    const fake = fakeExec(() =>
      Promise.resolve({ stdout: output(['a', 'unspecified'], ['b', 'unset']) })
    )

    const result = await pathsAssignFilters({
      git,
      dir: '/wt',
      paths: ['a', 'b'],
      maxPaths: 2,
      exec: fake.exec
    })

    expect({ result, calls: fake.calls() }).toEqual({
      result: { ok: true, value: false },
      calls: 1
    })
  })

  it('reports git-failed for a nonzero check-attr exit', async () => {
    const fake = fakeExec(() =>
      Promise.reject(Object.assign(new Error('x'), { code: 128, stdout: Buffer.from('') }))
    )

    const result = await pathsAssignFilters({ git, dir: '/wt', paths: ['a'], exec: fake.exec })

    expect(result).toEqual({ ok: false, error: 'git-failed' })
  })

  it('reports git-failed for output it cannot parse', async () => {
    const fake = fakeExec(() => Promise.resolve({ stdout: Buffer.from('a\0filter\0') }))

    const result = await pathsAssignFilters({ git, dir: '/wt', paths: ['a'], exec: fake.exec })

    expect(result).toEqual({ ok: false, error: 'git-failed' })
  })
})

describe('assignsFilter', () => {
  it.each([
    ['unspecified', false],
    ['unset', false],
    ['set', true],
    ['lfs', true]
  ])('reports %s as %s', (value, expected) => {
    expect(assignsFilter({ path: 'a', value })).toBe(expected)
  })
})
