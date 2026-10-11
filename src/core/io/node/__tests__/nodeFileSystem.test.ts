import { execFileSync } from 'node:child_process'
import type { ReadStream } from 'node:fs'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nodeFileSystem } from '../nodeFileSystem'

const created: ReadStream[] = []

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    createReadStream: ((...args: Parameters<typeof actual.createReadStream>) => {
      const stream = actual.createReadStream(...args)
      created.push(stream)
      return stream
    }) as typeof actual.createReadStream
  }
})

let dir: string

beforeEach(async () => {
  created.length = 0
  dir = await mkdtemp(join(tmpdir(), 'beekeeper-node-fs-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

async function collect(chunks: AsyncIterable<Uint8Array>): Promise<number[]> {
  const bytes: number[] = []
  for await (const chunk of chunks) bytes.push(...chunk)
  return bytes
}

describe('nodeFileSystem.readDir', () => {
  it('reports files, directories and symlinks without following links', async () => {
    await writeFile(join(dir, 'a.txt'), 'x')
    await mkdir(join(dir, 'sub'))
    await symlink(join(dir, 'sub'), join(dir, 'link'))

    const entries = await nodeFileSystem.readDir(dir)

    expect([...entries].sort((a, b) => a.name.localeCompare(b.name))).toEqual([
      { name: 'a.txt', kind: 'file' },
      { name: 'link', kind: 'symlink' },
      { name: 'sub', kind: 'directory' }
    ])
  })

  it('rejects with ENOENT for a missing directory', async () => {
    await expect(nodeFileSystem.readDir(join(dir, 'missing'))).rejects.toMatchObject({
      code: 'ENOENT'
    })
  })
})

describe('nodeFileSystem.lstat', () => {
  it('reports a symlink as a symlink', async () => {
    await writeFile(join(dir, 'target'), 'x')
    await symlink(join(dir, 'target'), join(dir, 'link'))

    const stat = await nodeFileSystem.lstat(join(dir, 'link'))

    expect(stat.kind).toBe('symlink')
  })

  it('reports kind, size, mtime and identity of a regular file', async () => {
    await writeFile(join(dir, 'f'), 'hello')

    const stat = await nodeFileSystem.lstat(join(dir, 'f'))

    expect(stat).toMatchObject({ kind: 'file', size: 5 })
    expect(stat.mtimeMs).toBeGreaterThan(0)
    expect(stat.ino).toBeGreaterThan(0)
  })

  it('rejects with ENOENT for a missing path', async () => {
    await expect(nodeFileSystem.lstat(join(dir, 'missing'))).rejects.toMatchObject({
      code: 'ENOENT'
    })
  })
})

describe('nodeFileSystem.readRange', () => {
  it('returns fewer bytes at the end of the file', async () => {
    await writeFile(join(dir, 'f'), '0123456789')

    const bytes = await nodeFileSystem.readRange(join(dir, 'f'), { position: 7, length: 100 })

    expect(Buffer.from(bytes).toString()).toBe('789')
  })

  it('returns an empty array past the end of the file', async () => {
    await writeFile(join(dir, 'f'), '0123')

    const bytes = await nodeFileSystem.readRange(join(dir, 'f'), { position: 50, length: 4 })

    expect(bytes.byteLength).toBe(0)
  })
})

describe('nodeFileSystem.readChunks', () => {
  it('yields the bytes from the start offset on', async () => {
    await writeFile(join(dir, 'f'), '0123456789')

    const bytes = await collect(nodeFileSystem.readChunks(join(dir, 'f'), { start: 3 }))

    expect(Buffer.from(bytes).toString()).toBe('3456789')
  })

  it('closes the file when the consumer stops early', async () => {
    await writeFile(join(dir, 'f'), 'abcdefghij')

    for await (const chunk of nodeFileSystem.readChunks(join(dir, 'f'), {
      start: 0,
      chunkSize: 2
    })) {
      expect(chunk.byteLength).toBeGreaterThan(0)
      break
    }

    expect(created).toHaveLength(1)
    expect(created[0]?.destroyed).toBe(true)
  })

  it('rejects with the OS error code when the file is missing', async () => {
    await expect(
      collect(nodeFileSystem.readChunks(join(dir, 'missing'), { start: 0 }))
    ).rejects.toMatchObject({ code: 'ENOENT' })
  })
})

describe('nodeFileSystem.readNoFollow', () => {
  it('returns the bytes of a regular file', async () => {
    await writeFile(join(dir, 'f'), '{"a":1}')

    const result = await nodeFileSystem.readNoFollow(join(dir, 'f'), 1024)

    expect(result.ok && Buffer.from(result.value).toString()).toBe('{"a":1}')
  })

  it('reports a symlink without following it', async () => {
    await writeFile(join(dir, 'target'), 'x')
    await symlink(join(dir, 'target'), join(dir, 'link'))

    const result = await nodeFileSystem.readNoFollow(join(dir, 'link'), 1024)

    expect(result).toEqual({ ok: false, error: { reason: 'symlink' } })
  })

  it('reports a directory as not-a-file', async () => {
    const result = await nodeFileSystem.readNoFollow(dir, 1024)

    expect(result).toEqual({ ok: false, error: { reason: 'not-a-file' } })
  })

  it('reports a FIFO as not-a-file without blocking', async () => {
    const fifo = join(dir, 'fifo')
    execFileSync('mkfifo', [fifo])

    const result = await nodeFileSystem.readNoFollow(fifo, 1024)

    expect(result).toEqual({ ok: false, error: { reason: 'not-a-file' } })
  })

  it('reports a file larger than maxBytes as too-large', async () => {
    await writeFile(join(dir, 'f'), 'x'.repeat(20))

    const result = await nodeFileSystem.readNoFollow(join(dir, 'f'), 10)

    expect(result).toEqual({ ok: false, error: { reason: 'too-large' } })
  })

  it('reports a missing file as missing', async () => {
    const result = await nodeFileSystem.readNoFollow(join(dir, 'missing'), 10)

    expect(result).toEqual({ ok: false, error: { reason: 'missing' } })
  })
})

describe('nodeFileSystem path helpers', () => {
  it('joins segments the platform way', () => {
    expect(nodeFileSystem.joinPath('/a', 'b', 'c.txt')).toBe(join('/a', 'b', 'c.txt'))
  })

  it('resolves a relative path to an absolute one', () => {
    expect(nodeFileSystem.resolvePath('/a/b/../c')).toBe('/a/c')
  })
})
