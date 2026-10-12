import { describe, expect, it, vi, type MockInstance } from 'vitest'
import { errorCode } from '../../../core/shared/errorCode'
import { installFileSystem } from '../../../core/io/installFileSystem'
import { readJsonlLines } from '../../../core/transcript/readJsonlLines'
import type { ModHost } from '../../modHost'
import { createTestHost, type TestPath } from '../../testHost'
import { FS_READ_LIMIT } from '../fsReadLimit'
import { createModFileSystem } from '../modFileSystem'

const encode = (text: string): Uint8Array => new TextEncoder().encode(text)
const decode = (bytes: Uint8Array): string => new TextDecoder().decode(bytes)

const ROOT = '/p'

/** A fake host and the port over it, which is also what core's `isInside` sees as installed. */
function filesystemOf(
  paths: Record<string, TestPath>,
  failures: Record<string, unknown> = {}
): { port: ReturnType<typeof createModFileSystem>; host: ReturnType<typeof createTestHost> } {
  const host = createTestHost({ paths, failures })
  const port = createModFileSystem({
    host,
    cwd: '/work',
    projectsRoot: ROOT,
    isProjectsRootResolved: true
  })
  installFileSystem(port)
  return { host, port }
}

const bigFile = (path = '/p/f'): Record<string, TestPath> => ({
  [path]: { kind: 'file', bytes: encode('abcdefgh'), size: FS_READ_LIMIT + 1 }
})

async function collect(chunks: AsyncIterable<Uint8Array>): Promise<string[]> {
  const out: string[] = []
  for await (const chunk of chunks) out.push(decode(chunk))
  return out
}

const rejectionOf = async (promise: Promise<unknown>): Promise<unknown> =>
  promise.then(
    () => undefined,
    (error: unknown) => error
  )

describe('readDir', () => {
  it('maps each entry kind and puts a symbolic link first', async () => {
    const entry = { size: 0, mtimeMs: 0 }
    const { port } = filesystemOf({
      '/d': {
        kind: 'dir',
        entries: [
          { name: 'a', kind: 'file', isLink: false, ...entry },
          { name: 'b', kind: 'dir', isLink: false, ...entry },
          { name: 'c', kind: 'other', isLink: false, ...entry },
          { name: 'd', kind: 'dir', isLink: true, ...entry }
        ]
      }
    })

    expect(await port.readDir('/d')).toEqual([
      { name: 'a', kind: 'file' },
      { name: 'b', kind: 'directory' },
      { name: 'c', kind: 'other' },
      { name: 'd', kind: 'symlink' }
    ])
  })

  it('rejects ENOENT for a missing directory', async () => {
    const { port } = filesystemOf({})

    expect(errorCode(await rejectionOf(port.readDir('/nope')))).toBe('ENOENT')
  })

  it('rejects with the code alone when the engine error carries a path', async () => {
    const { port } = filesystemOf(
      {},
      { '/d': new Error("EACCES: permission denied, scandir '/d'") }
    )

    const error = await rejectionOf(port.readDir('/d'))

    expect(errorCode(error)).toBe('EACCES')
    expect((error as Error).message).toBe('EACCES')
  })
})

describe('lstat', () => {
  it('reports a file with zeroed inode and device', async () => {
    const { port } = filesystemOf({ '/f': { kind: 'file', bytes: encode('abc') } })

    expect(await port.lstat('/f')).toEqual({
      kind: 'file',
      size: 3,
      mtimeMs: 1000,
      ino: 0,
      dev: 0
    })
  })

  it('reports a directory', async () => {
    const { port } = filesystemOf({ '/d': { kind: 'dir' } })

    expect((await port.lstat('/d')).kind).toBe('directory')
  })

  it('reports a symbolic link as its own, not its target', async () => {
    const { port } = filesystemOf({
      '/l': { kind: 'file', bytes: encode('abc'), isLink: true, realPath: '/f' }
    })

    expect(await port.lstat('/l')).toEqual({
      kind: 'symlink',
      size: 0,
      mtimeMs: 0,
      ino: 0,
      dev: 0
    })
  })

  it('rejects ENOENT for a missing path', async () => {
    const { port } = filesystemOf({})

    expect(errorCode(await rejectionOf(port.lstat('/nope')))).toBe('ENOENT')
  })
})

describe('readNoFollow', () => {
  it('returns the bytes of a file within the cap', async () => {
    const { port } = filesystemOf({ '/f': { kind: 'file', bytes: encode('hello') } })

    const result = await port.readNoFollow('/f', 10)

    expect(result.ok && decode(result.value)).toBe('hello')
  })

  it.each([
    ['a missing path', {}, 'missing'],
    ['a symbolic link', { '/f': { kind: 'file', isLink: true } }, 'symlink'],
    ['a directory', { '/f': { kind: 'dir' } }, 'not-a-file'],
    ['a file over the cap', { '/f': { kind: 'file', bytes: encode('hello') } }, 'too-large']
  ] as const)('refuses %s', async (_name, paths, reason) => {
    const { port } = filesystemOf({ ...paths })

    expect(await port.readNoFollow('/f', 4)).toEqual({ ok: false, error: { reason } })
  })

  it('refuses a file that grows past the cap between the check and the read', async () => {
    const { port, host } = filesystemOf({ '/f': { kind: 'file', bytes: encode('hi') } })
    vi.spyOn(host, 'readBytes').mockResolvedValue(encode('hello'))

    expect(await port.readNoFollow('/f', 4)).toEqual({ ok: false, error: { reason: 'too-large' } })
  })

  it('reports missing when the file vanishes between the check and the read', async () => {
    const { port, host } = filesystemOf({ '/f': { kind: 'file', bytes: encode('hi') } })
    vi.spyOn(host, 'readBytes').mockRejectedValue(new Error('ENOENT: gone'))

    expect(await port.readNoFollow('/f', 4)).toEqual({ ok: false, error: { reason: 'missing' } })
  })

  it('reads a file over the engine read limit through tail when it fits the cap', async () => {
    const { port, host } = filesystemOf(bigFile())
    const readBytes = vi.spyOn(host, 'readBytes')

    const result = await port.readNoFollow('/p/f', FS_READ_LIMIT * 2)

    expect(result.ok && decode(result.value)).toBe('abcdefgh')
    expect(readBytes).not.toHaveBeenCalled()
  })

  it('refuses a file over the engine read limit that is over the cap', async () => {
    const { port } = filesystemOf(bigFile())

    expect(await port.readNoFollow('/p/f', FS_READ_LIMIT)).toEqual({
      ok: false,
      error: { reason: 'too-large' }
    })
  })

  it('rejects EACCES for a big file whose real path is outside the projects folder', async () => {
    const { port, host } = filesystemOf({
      '/p/f': { kind: 'file', size: FS_READ_LIMIT + 1, isLink: false, realPath: '/etc/passwd' }
    })
    const tail = vi.spyOn(host, 'tail')

    expect(errorCode(await rejectionOf(port.readNoFollow('/p/f', FS_READ_LIMIT * 2)))).toBe(
      'EACCES'
    )
    expect(tail).not.toHaveBeenCalled()
  })

  it('rethrows other failures as port errors', async () => {
    const { port } = filesystemOf({}, { '/f': Object.assign(new Error('x'), { code: 'EACCES' }) })

    expect(errorCode(await rejectionOf(port.readNoFollow('/f', 4)))).toBe('EACCES')
  })
})

describe('readChunks', () => {
  const file = { '/f': { kind: 'file', bytes: encode('abcdefgh') } } as const

  it('yields the file in chunks of the preferred size', async () => {
    const { port } = filesystemOf(file)

    expect(await collect(port.readChunks('/f', { start: 0, chunkSize: 3 }))).toEqual([
      'abc',
      'def',
      'gh'
    ])
  })

  it('starts at the offset', async () => {
    const { port } = filesystemOf(file)

    expect(await collect(port.readChunks('/f', { start: 5, chunkSize: 10 }))).toEqual(['fgh'])
  })

  it('yields nothing at or past the end', async () => {
    const { port } = filesystemOf(file)

    expect(await collect(port.readChunks('/f', { start: 8 }))).toEqual([])
    expect(await collect(port.readChunks('/f', { start: 99 }))).toEqual([])
  })

  it('falls back to the default chunk size for a fractional size that floors to zero', async () => {
    const { port } = filesystemOf(file)

    expect(await collect(port.readChunks('/f', { start: 0, chunkSize: 0.5 }))).toEqual(['abcdefgh'])
  })

  it('floors a fractional chunk size', async () => {
    const { port } = filesystemOf(file)

    expect(await collect(port.readChunks('/f', { start: 0, chunkSize: 3.9 }))).toEqual([
      'abc',
      'def',
      'gh'
    ])
  })

  it('falls back to the default chunk size when asked for none that makes sense', async () => {
    const { port } = filesystemOf(file)

    expect(await collect(port.readChunks('/f', { start: 0, chunkSize: 0 }))).toEqual(['abcdefgh'])
  })

  it('rejects on the first pull when the file is missing', async () => {
    const { port } = filesystemOf({})
    const chunks = port.readChunks('/nope', { start: 0 })[Symbol.asyncIterator]()

    expect(errorCode(await rejectionOf(chunks.next()))).toBe('ENOENT')
  })

  it('rejects on the first pull for a start that is negative', async () => {
    const { port } = filesystemOf(file)
    const chunks = port.readChunks('/f', { start: -1 })[Symbol.asyncIterator]()

    expect(await rejectionOf(chunks.next())).toBeInstanceOf(RangeError)
  })

  it('streams a file over the engine read limit through tail', async () => {
    const { port, host } = filesystemOf(bigFile())
    const tail = vi.spyOn(host, 'tail')

    expect((await collect(port.readChunks('/p/f', { start: 2 }))).join('')).toBe('cdefgh')
    expect(tail).toHaveBeenCalledWith('/p/f', 2)
  })

  it('runs tail on the real path of a link under the projects folder', async () => {
    const { port, host } = filesystemOf({
      ...bigFile('/p/real'),
      '/p/link': {
        kind: 'file',
        bytes: encode('abcdefgh'),
        size: FS_READ_LIMIT + 1,
        isLink: true,
        realPath: '/p/real'
      }
    })
    const tail = vi.spyOn(host, 'tail')

    await collect(port.readChunks('/p/link', { start: 0 }))

    expect(tail).toHaveBeenCalledWith('/p/real', 0)
  })

  it('rejects EACCES on the first pull for a big file outside the projects folder', async () => {
    const { port } = filesystemOf(bigFile('/etc/big'))
    const chunks = port.readChunks('/etc/big', { start: 0 })[Symbol.asyncIterator]()

    expect(errorCode(await rejectionOf(chunks.next()))).toBe('EACCES')
  })
})

describe('readRange', () => {
  const file = { '/f': { kind: 'file', bytes: encode('abcdefgh') } } as const

  it('reads the requested range', async () => {
    const { port } = filesystemOf(file)

    expect(decode(await port.readRange('/f', { position: 2, length: 3 }))).toBe('cde')
  })

  it('reads fewer bytes at the end of the file', async () => {
    const { port } = filesystemOf(file)

    expect(decode(await port.readRange('/f', { position: 6, length: 10 }))).toBe('gh')
  })

  it('answers empty at or past the end', async () => {
    const { port } = filesystemOf(file)

    expect(await port.readRange('/f', { position: 99, length: 4 })).toHaveLength(0)
  })

  it('rejects ENOENT for a missing file', async () => {
    const { port } = filesystemOf({})

    expect(errorCode(await rejectionOf(port.readRange('/nope', { position: 0, length: 1 })))).toBe(
      'ENOENT'
    )
  })

  it('reads a range of a file over the engine read limit through tail', async () => {
    const { port, host } = filesystemOf(bigFile())
    const tail = vi.spyOn(host, 'tail')

    expect(decode(await port.readRange('/p/f', { position: 2, length: 3 }))).toBe('cde')
    expect(tail).toHaveBeenCalledWith('/p/f', 2)
  })

  it('stops pulling from tail once it has the bytes it asked for', async () => {
    const { port, host } = filesystemOf(bigFile())
    let pulled = 0
    let returned = false
    vi.spyOn(host, 'tail').mockImplementation(async function* () {
      try {
        for (;;) {
          pulled += 1
          yield { stream: 'stdout' as const, text: 'abcd' }
        }
      } finally {
        returned = true
      }
    })

    expect(decode(await port.readRange('/p/f', { position: 0, length: 6 }))).toBe('abcdab')
    expect(pulled).toBe(2)
    expect(returned).toBe(true)
  })

  it('answers empty for a zero length without spawning tail', async () => {
    const { port, host } = filesystemOf(bigFile())
    const tail = vi.spyOn(host, 'tail')

    expect(await port.readRange('/p/f', { position: 0, length: 0 })).toHaveLength(0)
    expect(tail).not.toHaveBeenCalled()
  })
})

describe('realPath', () => {
  it('answers where the path lands', async () => {
    const { port } = filesystemOf({ '/l': { kind: 'file', isLink: true, realPath: '/f' } })

    expect(await port.realPath('/l')).toBe('/f')
  })

  it('rejects ENOENT when the engine reports no real path', async () => {
    const { host } = filesystemOf({})
    vi.spyOn(host, 'stat').mockResolvedValue({ kind: 'file', size: 0, mtimeMs: 0, isLink: false })
    const port = createModFileSystem({
      host,
      cwd: '/work',
      projectsRoot: ROOT,
      isProjectsRootResolved: true
    })

    expect(errorCode(await rejectionOf(port.realPath('/x')))).toBe('ENOENT')
  })

  it('rejects ENOENT for a missing path', async () => {
    const { port } = filesystemOf({})

    expect(errorCode(await rejectionOf(port.realPath('/nope')))).toBe('ENOENT')
  })
})

describe('readLink', () => {
  it('answers the absolute target of a link', async () => {
    const { port } = filesystemOf({ '/l': { kind: 'file', isLink: true, realPath: '/f' } })

    expect(await port.readLink('/l')).toBe('/f')
  })

  it('rejects EINVAL for a path that is not a link', async () => {
    const { port } = filesystemOf({ '/f': { kind: 'file' } })

    expect(errorCode(await rejectionOf(port.readLink('/f')))).toBe('EINVAL')
  })

  it('rejects ENOENT for a missing path', async () => {
    const { port } = filesystemOf({})

    expect(errorCode(await rejectionOf(port.readLink('/nope')))).toBe('ENOENT')
  })
})

describe('paths', () => {
  it('joins POSIX style', () => {
    const { port } = filesystemOf({})

    expect(port.joinPath('/a', 'b/../c')).toBe('/a/c')
  })

  it('resolves against the session working directory', () => {
    const { port } = filesystemOf({})

    expect(port.resolvePath('x')).toBe('/work/x')
  })
})

describe('with core installed on it', () => {
  it('reads both lines of a JSONL file through readJsonlLines', async () => {
    const { port } = filesystemOf({
      '/work/s.jsonl': { kind: 'file', bytes: encode('{"a":1}\n{"b":2}\n') }
    })
    installFileSystem(port)

    const lines: string[] = []
    for await (const line of readJsonlLines('/work/s.jsonl')) {
      if (line.ok) lines.push(line.value)
    }

    expect(lines).toEqual(['{"a":1}', '{"b":2}'])
  })
})

describe('a projects folder that did not exist at startup', () => {
  const ROOT_LINK = '/home/u/.claude/projects'
  const REAL_ROOT = '/data/projects'
  const FILE = `${REAL_ROOT}/p/s.jsonl`

  function setup(isProjectsRootResolved: boolean): {
    port: ReturnType<typeof createModFileSystem>
    paths: Record<string, TestPath>
    real: ModHost['stat']
    stat: MockInstance<ModHost['stat']>
  } {
    const paths: Record<string, TestPath> = {
      [FILE]: { kind: 'file', bytes: encode('abcdefgh'), size: FS_READ_LIMIT + 1 }
    }
    const host = createTestHost({ paths })
    const port = createModFileSystem({
      host,
      cwd: '/work',
      projectsRoot: ROOT_LINK,
      isProjectsRootResolved
    })
    installFileSystem(port)
    const real = host.stat.bind(host)
    return { port, paths, real, stat: vi.spyOn(host, 'stat') }
  }

  const makeRootAppear = (paths: Record<string, TestPath>): void => {
    paths[ROOT_LINK] = { kind: 'dir', isLink: true, realPath: REAL_ROOT }
  }

  it('keeps looking while the link has no target yet, then resolves once it has one', async () => {
    const { port, paths, real, stat } = setup(false)
    makeRootAppear(paths)
    let hasTarget = false
    stat.mockImplementation(async (path) => {
      const found = await real(path)
      return path === ROOT_LINK && !hasTarget ? { ...found, realPath: undefined } : found
    })
    const first = port.readChunks(FILE, { start: 0 })[Symbol.asyncIterator]()
    expect(errorCode(await rejectionOf(first.next()))).toBe('EACCES')

    hasTarget = true

    expect((await collect(port.readChunks(FILE, { start: 0 }))).join('')).toBe('abcdefgh')
  })

  it('refuses a big file until the folder exists', async () => {
    const { port } = setup(false)
    const chunks = port.readChunks(FILE, { start: 0 })[Symbol.asyncIterator]()

    expect(errorCode(await rejectionOf(chunks.next()))).toBe('EACCES')
  })

  it('resolves the folder through its link on the first tail read after it appears', async () => {
    const { port, paths } = setup(false)
    makeRootAppear(paths)

    expect((await collect(port.readChunks(FILE, { start: 0 }))).join('')).toBe('abcdefgh')
  })

  it('keeps the resolved folder instead of asking again', async () => {
    const { port, paths, stat } = setup(false)
    makeRootAppear(paths)
    await collect(port.readChunks(FILE, { start: 0 }))
    stat.mockClear()

    await collect(port.readChunks(FILE, { start: 0 }))

    expect(stat.mock.calls.map(([path]) => path)).toEqual([FILE])
  })

  it('still refuses a file outside the resolved folder', async () => {
    const { port, paths } = setup(false)
    makeRootAppear(paths)
    paths['/data/other/x'] = { kind: 'file', bytes: encode('x'), size: FS_READ_LIMIT + 1 }
    const chunks = port.readChunks('/data/other/x', { start: 0 })[Symbol.asyncIterator]()

    expect(errorCode(await rejectionOf(chunks.next()))).toBe('EACCES')
  })

  it('does not ask about a folder that was resolved at startup', async () => {
    const { port, paths, stat } = setup(true)
    makeRootAppear(paths)

    await rejectionOf(collect(port.readChunks(FILE, { start: 0 })))

    expect(stat.mock.calls.map(([path]) => path)).toEqual([FILE])
  })
})

describe('the last whole-file read', () => {
  const file = (extra: Partial<TestPath> = {}): TestPath => ({
    kind: 'file',
    bytes: encode('abcdefgh'),
    ...extra
  })

  function setup(): {
    port: ReturnType<typeof createModFileSystem>
    paths: Record<string, TestPath>
    readBytes: MockInstance<ModHost['readBytes']>
  } {
    const paths: Record<string, TestPath> = { '/p/f': file(), '/p/g': file() }
    const { port, host } = filesystemOf(paths)
    return { port, paths, readBytes: vi.spyOn(host, 'readBytes') }
  }

  it('is reused by readRange, readChunks and readNoFollow on an unchanged file', async () => {
    const { port, readBytes } = setup()

    await port.readRange('/p/f', { position: 0, length: 2 })
    await collect(port.readChunks('/p/f', { start: 0 }))
    await port.readNoFollow('/p/f', 100)
    await port.readRange('/p/f', { position: 4, length: 2 })

    expect(readBytes).toHaveBeenCalledTimes(1)
  })

  it('still answers each call from the right bytes', async () => {
    const { port } = setup()

    await port.readRange('/p/f', { position: 0, length: 2 })

    expect(decode(await port.readRange('/p/f', { position: 3, length: 4 }))).toBe('defg')
    expect((await collect(port.readChunks('/p/f', { start: 6 }))).join('')).toBe('gh')
  })

  it('is read again when the size changes', async () => {
    const { port, paths, readBytes } = setup()
    await port.readRange('/p/f', { position: 0, length: 2 })

    paths['/p/f'] = file({ bytes: encode('abcdefghi') })

    expect(decode(await port.readRange('/p/f', { position: 8, length: 2 }))).toBe('i')
    expect(readBytes).toHaveBeenCalledTimes(2)
  })

  it('is read again when the modification time changes', async () => {
    const { port, paths, readBytes } = setup()
    await port.readRange('/p/f', { position: 0, length: 2 })

    paths['/p/f'] = file({ bytes: encode('ABCDEFGH'), mtimeMs: 2000 })

    expect(decode(await port.readRange('/p/f', { position: 0, length: 2 }))).toBe('AB')
    expect(readBytes).toHaveBeenCalledTimes(2)
  })

  it('misses when a link is re-pointed to another file of the same size and time', async () => {
    const { port, paths, readBytes } = setup()
    paths['/p/l'] = file({ isLink: true, realPath: '/p/f', bytes: encode('aaaa') })
    await port.readRange('/p/l', { position: 0, length: 4 })

    paths['/p/l'] = file({ isLink: true, realPath: '/p/g', bytes: encode('bbbb') })

    expect(decode(await port.readRange('/p/l', { position: 0, length: 4 }))).toBe('bbbb')
    expect(readBytes).toHaveBeenCalledTimes(2)
  })

  it('holds one file: reading another path replaces it', async () => {
    const { port, readBytes } = setup()

    await port.readRange('/p/f', { position: 0, length: 1 })
    await port.readRange('/p/g', { position: 0, length: 1 })
    await port.readRange('/p/f', { position: 0, length: 1 })

    expect(readBytes).toHaveBeenCalledTimes(3)
  })
})
