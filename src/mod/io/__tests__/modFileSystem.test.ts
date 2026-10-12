import { describe, expect, it, vi } from 'vitest'
import { errorCode } from '../../../core/shared/errorCode'
import { installFileSystem } from '../../../core/io/installFileSystem'
import { readJsonlLines } from '../../../core/transcript/readJsonlLines'
import { createTestHost, type TestPath } from '../../testHost'
import { FS_READ_LIMIT } from '../fsReadLimit'
import { createModFileSystem } from '../modFileSystem'

const encode = (text: string): Uint8Array => new TextEncoder().encode(text)
const decode = (bytes: Uint8Array): string => new TextDecoder().decode(bytes)

function filesystemOf(
  paths: Record<string, TestPath>,
  failures: Record<string, unknown> = {}
): { port: ReturnType<typeof createModFileSystem>; host: ReturnType<typeof createTestHost> } {
  const host = createTestHost({ paths, failures })
  return { host, port: createModFileSystem({ host, cwd: '/work' }) }
}

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

  it('rejects EFBIG for a file over the engine read limit that fits the cap', async () => {
    const { port, host } = filesystemOf({ '/f': { kind: 'file', size: FS_READ_LIMIT + 1 } })
    const readBytes = vi.spyOn(host, 'readBytes')

    const error = await rejectionOf(port.readNoFollow('/f', FS_READ_LIMIT * 2))

    expect(errorCode(error)).toBe('EFBIG')
    expect(readBytes).not.toHaveBeenCalled()
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

  it('rejects EFBIG on the first pull for a file over the engine read limit', async () => {
    const { port } = filesystemOf({ '/f': { kind: 'file', size: FS_READ_LIMIT + 1 } })
    const chunks = port.readChunks('/f', { start: 0 })[Symbol.asyncIterator]()

    expect(errorCode(await rejectionOf(chunks.next()))).toBe('EFBIG')
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

  it('rejects EFBIG for a file over the engine read limit', async () => {
    const { port } = filesystemOf({ '/f': { kind: 'file', size: FS_READ_LIMIT + 1 } })

    expect(errorCode(await rejectionOf(port.readRange('/f', { position: 0, length: 1 })))).toBe(
      'EFBIG'
    )
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
    const port = createModFileSystem({ host, cwd: '/work' })

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
