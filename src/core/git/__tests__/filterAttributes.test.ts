import { describe, expect, it } from 'vitest'
import { toGitBinary } from '../gitBinary'
import {
  batchPaths,
  CHECK_ATTR_BATCH_BYTES,
  CHECK_ATTR_BATCH_SIZE,
  CHECK_ATTR_MAX_OUTPUT,
  MAX_CHECK_ATTR_BATCHES,
  parseFilterAttributes,
  pathsAssignFilters
} from '../filterAttributes'
import type { GitExecFn } from '../runGit'

/** Builds `git check-attr -z --all` output for the given path, attribute, and value records. */
function output(...records: readonly (readonly [string, string, string])[]): Buffer {
  return Buffer.from(records.map((fields) => `${fields.join('\0')}\0`).join(''))
}

/** Builds output holding only `filter` records for the given path and value pairs. */
function filterOutput(...records: readonly (readonly [string, string])[]): Buffer {
  return output(...records.map(([path, value]) => [path, 'filter', value] as const))
}

/** Paths of `count` names, each `width` characters wide. */
function namedPaths(count: number, width: number): string[] {
  return Array.from({ length: count }, (_, n) => String(n).padStart(width, 'p'))
}

describe('batchPaths', () => {
  it('splits paths into consecutive batches of the given size', () => {
    expect(batchPaths(['a', 'b', 'c', 'd', 'e', 'f', 'g'], { size: 3 })).toEqual([
      ['a', 'b', 'c'],
      ['d', 'e', 'f'],
      ['g']
    ])
  })

  it('returns no batches for no paths', () => {
    expect(batchPaths([])).toEqual([])
  })

  it('splits past the default batch size', () => {
    const paths = namedPaths(CHECK_ATTR_BATCH_SIZE + 1, 4)

    expect(batchPaths(paths).map((batch) => batch.length)).toEqual([CHECK_ATTR_BATCH_SIZE, 1])
  })

  it('keeps a batch exactly at the size whole', () => {
    expect(batchPaths(namedPaths(CHECK_ATTR_BATCH_SIZE, 4))).toHaveLength(1)
  })

  it('splits by bytes before the count limit is reached', () => {
    // Each path costs 100 bytes with its terminator, so 3 fit in 300 and the 4th starts a batch.
    const paths = namedPaths(4, 99)

    expect(batchPaths(paths, { bytes: 350 }).map((batch) => batch.length)).toEqual([3, 1])
  })

  it('keeps a batch exactly at the byte budget whole', () => {
    const paths = namedPaths(3, 99)

    expect(batchPaths(paths, { bytes: 300 })).toHaveLength(1)
  })

  it('counts UTF-8 bytes, not characters', () => {
    // Two-byte characters: each path costs 21 bytes, so two exceed 40.
    const paths = ['é'.repeat(10), 'é'.repeat(10)]

    expect(batchPaths(paths, { bytes: 40 })).toHaveLength(2)
  })

  it('gives a path over the byte budget a batch of its own', () => {
    expect(batchPaths(['a', 'b'.repeat(50), 'c'], { bytes: 10 })).toEqual([
      ['a'],
      ['b'.repeat(50)],
      ['c']
    ])
  })
})

describe('parseFilterAttributes', () => {
  it.each(['unspecified', 'unset', 'set', 'lfs'])('reads the value %s', (value) => {
    expect(parseFilterAttributes(filterOutput(['a.bin', value]))).toEqual({
      ok: true,
      value: [{ path: 'a.bin', value }]
    })
  })

  it('reads several records in order, with a path holding a space or newline', () => {
    const result = parseFilterAttributes(filterOutput(['a b.bin', 'lfs'], ['c\nd', 'unspecified']))

    expect(result).toEqual({
      ok: true,
      value: [
        { path: 'a b.bin', value: 'lfs' },
        { path: 'c\nd', value: 'unspecified' }
      ]
    })
  })

  it('skips records for other attributes', () => {
    const result = parseFilterAttributes(
      output(['a.bin', 'text', 'set'], ['a.bin', 'filter', 'lfs'], ['a.bin', 'diff', 'lfs'])
    )

    expect(result).toEqual({ ok: true, value: [{ path: 'a.bin', value: 'lfs' }] })
  })

  it('reads output with no filter record as no entries', () => {
    expect(parseFilterAttributes(output(['a.txt', 'text', 'set']))).toEqual({
      ok: true,
      value: []
    })
  })

  it('reads empty output as no entries', () => {
    expect(parseFilterAttributes(Buffer.from(''))).toEqual({ ok: true, value: [] })
  })

  it.each([
    ['a truncated record', Buffer.from('a.bin\0filter\0')],
    ['a missing final terminator', Buffer.from('a.bin\0filter\0lfs')],
    ['a truncated record for another attribute', Buffer.from('a.bin\0text\0')]
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

  it('counts a path over the byte budget as assigned without running git', async () => {
    const fake = fakeExec(() => Promise.resolve({ stdout: Buffer.from('') }))

    const result = await pathsAssignFilters({
      git,
      dir: '/wt',
      paths: ['ok.txt', 'x'.repeat(CHECK_ATTR_BATCH_BYTES)],
      exec: fake.exec
    })

    expect({ result, calls: fake.calls() }).toEqual({ result: { ok: true, value: true }, calls: 0 })
  })

  it('checks a path exactly at the byte budget', async () => {
    const fake = fakeExec(() => Promise.resolve({ stdout: Buffer.from('') }))

    const result = await pathsAssignFilters({
      git,
      dir: '/wt',
      paths: ['x'.repeat(CHECK_ATTR_BATCH_BYTES - 1)],
      exec: fake.exec
    })

    expect({ result, calls: fake.calls() }).toEqual({
      result: { ok: true, value: false },
      calls: 1
    })
  })

  it('counts more batches than the cap as assigned without running git', async () => {
    const fake = fakeExec(() => Promise.resolve({ stdout: Buffer.from('') }))

    const result = await pathsAssignFilters({
      git,
      dir: '/wt',
      paths: namedPaths(CHECK_ATTR_BATCH_SIZE * 2 + 1, 5),
      maxBatches: 2,
      exec: fake.exec
    })

    expect({ result, calls: fake.calls() }).toEqual({ result: { ok: true, value: true }, calls: 0 })
  })

  it('counts long paths that need more batches than the cap as assigned without running git', async () => {
    const fake = fakeExec(() => Promise.resolve({ stdout: Buffer.from('') }))

    const result = await pathsAssignFilters({
      git,
      dir: '/wt',
      paths: ['a', 'b', 'c'].map((name) => name.repeat(40_000)),
      maxBatches: 2,
      exec: fake.exec
    })

    expect({ result, calls: fake.calls() }).toEqual({ result: { ok: true, value: true }, calls: 0 })
  })

  it('checks every batch up to the cap', async () => {
    const fake = fakeExec(() => Promise.resolve({ stdout: Buffer.from('') }))

    const result = await pathsAssignFilters({
      git,
      dir: '/wt',
      paths: namedPaths(CHECK_ATTR_BATCH_SIZE * 2, 5),
      maxBatches: 2,
      exec: fake.exec
    })

    expect({ result, calls: fake.calls() }).toEqual({
      result: { ok: true, value: false },
      calls: 2
    })
  })

  it('defaults the batch cap to MAX_CHECK_ATTR_BATCHES', async () => {
    const fake = fakeExec(() => Promise.resolve({ stdout: Buffer.from('') }))

    const result = await pathsAssignFilters({
      git,
      dir: '/wt',
      paths: namedPaths(CHECK_ATTR_BATCH_SIZE * MAX_CHECK_ATTR_BATCHES + 1, 6),
      exec: fake.exec
    })

    expect({ result, calls: fake.calls() }).toEqual({ result: { ok: true, value: true }, calls: 0 })
  })

  it.each(['unspecified', 'unset', 'set', '', 'lfs'])(
    'counts a filter record with the value %j as assigned',
    async (value) => {
      const fake = fakeExec(() => Promise.resolve({ stdout: filterOutput(['a', value]) }))

      const result = await pathsAssignFilters({ git, dir: '/wt', paths: ['a'], exec: fake.exec })

      expect(result).toEqual({ ok: true, value: true })
    }
  )

  it('counts output with only other attributes as not assigned', async () => {
    const fake = fakeExec(() =>
      Promise.resolve({ stdout: output(['a', 'text', 'set'], ['b', 'diff', 'unset']) })
    )

    const result = await pathsAssignFilters({ git, dir: '/wt', paths: ['a', 'b'], exec: fake.exec })

    expect(result).toEqual({ ok: true, value: false })
  })

  it('counts output that overflows the buffer as assigned', async () => {
    const fake = fakeExec(() =>
      Promise.reject(Object.assign(new Error('x'), { code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' }))
    )

    const result = await pathsAssignFilters({ git, dir: '/wt', paths: ['a'], exec: fake.exec })

    expect(result).toEqual({ ok: true, value: true })
  })

  it('caps each batch at CHECK_ATTR_MAX_OUTPUT of output', async () => {
    const buffers: number[] = []
    const exec: GitExecFn = (_file, _args, options) => {
      buffers.push(options.maxBuffer)
      return Promise.resolve({ stdout: Buffer.from('') })
    }

    await pathsAssignFilters({ git, dir: '/wt', paths: ['a'], exec })

    expect(buffers).toEqual([CHECK_ATTR_MAX_OUTPUT])
  })

  it('still reports a timeout', async () => {
    const fake = fakeExec(() => Promise.reject(Object.assign(new Error('x'), { killed: true })))

    const result = await pathsAssignFilters({ git, dir: '/wt', paths: ['a'], exec: fake.exec })

    expect(result).toEqual({ ok: false, error: 'timeout' })
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
