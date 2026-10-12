import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installFileSystem } from '../../../core/io/installFileSystem'
import { errorCode } from '../../../core/shared/errorCode'
import type { HostTailChunk, HostTailResult } from '../../modHost'
import { createTestHost, type TestPath } from '../../testHost'
import { FS_READ_LIMIT } from '../fsReadLimit'
import { createModFileSystem } from '../modFileSystem'
import { readThroughTail } from '../readThroughTail'

const ROOT = '/home/u/.claude/projects'
const FILE = `${ROOT}/p/s.jsonl`
const BIG = FS_READ_LIMIT + 1
const bigFile = (extra: Partial<TestPath> = {}): TestPath => ({
  kind: 'file',
  bytes: new TextEncoder().encode('abcdefghij'),
  size: BIG,
  ...extra
})

function setup(paths: Record<string, TestPath>): ReturnType<typeof createTestHost> {
  const host = createTestHost({ paths })
  installFileSystem(createModFileSystem({ host, cwd: '/work', projectsRoot: ROOT }))
  return host
}

async function textOf(chunks: AsyncIterable<Uint8Array>): Promise<string> {
  let text = ''
  for await (const chunk of chunks) text += new TextDecoder().decode(chunk)
  return text
}

const rejectionOf = async (promise: Promise<unknown>): Promise<unknown> =>
  promise.then(
    () => undefined,
    (error: unknown) => error
  )

describe('readThroughTail', () => {
  beforeEach(() => {
    installFileSystem(
      createModFileSystem({ host: createTestHost(), cwd: '/work', projectsRoot: ROOT })
    )
  })

  it('streams a file under the projects folder from the start', async () => {
    const host = setup({ [FILE]: bigFile() })
    const tail = vi.spyOn(host, 'tail')

    const text = await textOf(readThroughTail({ host, projectsRoot: ROOT, path: FILE, start: 0 }))

    expect(text).toBe('abcdefghij')
    expect(tail).toHaveBeenCalledWith(FILE, 0)
  })

  it('starts at the byte offset', async () => {
    const host = setup({ [FILE]: bigFile() })
    const tail = vi.spyOn(host, 'tail')

    const text = await textOf(readThroughTail({ host, projectsRoot: ROOT, path: FILE, start: 5 }))

    expect(text).toBe('fghij')
    expect(tail).toHaveBeenCalledWith(FILE, 5)
  })

  it('runs tail on the resolved path, not the one it was given', async () => {
    const link = `${ROOT}/p/link.jsonl`
    const host = setup({ [FILE]: bigFile(), [link]: bigFile({ isLink: true, realPath: FILE }) })
    const tail = vi.spyOn(host, 'tail')

    await textOf(readThroughTail({ host, projectsRoot: ROOT, path: link, start: 0 }))

    expect(tail).toHaveBeenCalledWith(FILE, 0)
  })

  it.each([
    [
      'a link to a file outside the projects folder',
      `${ROOT}/p/key`,
      { realPath: '/home/u/.ssh/id_ed25519' }
    ],
    ['a path that climbs out with ..', `${ROOT}/../../.ssh/id_ed25519`, {}],
    ['a sibling folder that shares the root as a prefix', `${ROOT}-evil/x`, {}]
  ])('refuses %s before any spawn', async (_name, path, extra) => {
    const host = setup({ [path]: bigFile(extra) })
    const tail = vi.spyOn(host, 'tail')

    const error = await rejectionOf(
      textOf(readThroughTail({ host, projectsRoot: ROOT, path, start: 0 }))
    )

    expect(errorCode(error)).toBe('EACCES')
    expect((error as Error).message).toBe('outside the projects folder')
    expect(tail).not.toHaveBeenCalled()
  })

  it('refuses a path the engine reports no real path for', async () => {
    const host = setup({ [FILE]: bigFile() })
    vi.spyOn(host, 'stat').mockResolvedValue({ kind: 'file', size: BIG, mtimeMs: 0, isLink: false })
    const tail = vi.spyOn(host, 'tail')

    const error = await rejectionOf(
      textOf(readThroughTail({ host, projectsRoot: ROOT, path: FILE, start: 0 }))
    )

    expect(errorCode(error)).toBe('EACCES')
    expect(tail).not.toHaveBeenCalled()
  })

  it('rejects ENOENT for a missing file', async () => {
    const host = setup({})

    const error = await rejectionOf(
      textOf(readThroughTail({ host, projectsRoot: ROOT, path: FILE, start: 0 }))
    )

    expect(errorCode(error)).toBe('ENOENT')
  })

  it('rejects EIO with no path in the message when tail exits non-zero', async () => {
    const host = setup({ [FILE]: bigFile({ tailExitCode: 1 }) })

    const error = await rejectionOf(
      textOf(readThroughTail({ host, projectsRoot: ROOT, path: FILE, start: 0 }))
    )

    expect(errorCode(error)).toBe('EIO')
    expect((error as Error).message).toBe('EIO')
  })

  it('returns the tail iterator when the reader stops early', async () => {
    const host = setup({ [FILE]: bigFile() })
    let returned = false
    vi.spyOn(host, 'tail').mockImplementation(async function* (): AsyncGenerator<
      HostTailChunk,
      HostTailResult
    > {
      try {
        for (;;) yield { stream: 'stdout', text: 'abcd' }
      } finally {
        returned = true
      }
    })

    const chunks = readThroughTail({ host, projectsRoot: ROOT, path: FILE, start: 0 })
    await chunks.next()
    await chunks.return()

    expect(returned).toBe(true)
  })

  it('ignores stderr text', async () => {
    const host = setup({ [FILE]: bigFile() })
    vi.spyOn(host, 'tail').mockImplementation(async function* (): AsyncGenerator<
      HostTailChunk,
      HostTailResult
    > {
      yield { stream: 'stderr', text: 'warning: /secret/path' }
      yield { stream: 'stdout', text: 'ok' }
      return { code: 0, signal: null }
    })

    const text = await textOf(readThroughTail({ host, projectsRoot: ROOT, path: FILE, start: 0 }))

    expect(text).toBe('ok')
  })
})
