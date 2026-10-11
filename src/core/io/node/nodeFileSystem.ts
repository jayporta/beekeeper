import { constants, createReadStream } from 'node:fs'
import { lstat, open, readdir, readlink, realpath, type FileHandle } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { errorCode } from '../../shared/errorCode'
import { err, ok, type Result } from '../../shared/result'
import { isMissingEntryError } from '../../shared/isMissingEntryError'
import type {
  DirEntryKind,
  FileSystemPort,
  ReadChunksOptions,
  ReadNoFollowError,
  ReadRangeOptions
} from '../fileSystemPort'

interface KindProbe {
  isFile(): boolean
  isDirectory(): boolean
  isSymbolicLink(): boolean
}

function kindOf(probe: KindProbe): DirEntryKind {
  if (probe.isFile()) return 'file'
  if (probe.isDirectory()) return 'directory'
  if (probe.isSymbolicLink()) return 'symlink'
  return 'other'
}

async function* readChunks(path: string, options: ReadChunksOptions): AsyncGenerator<Uint8Array> {
  const stream = createReadStream(path, {
    start: options.start,
    highWaterMark: options.chunkSize
  })
  try {
    for await (const chunk of stream) yield chunk as Uint8Array
  } finally {
    stream.destroy()
  }
}

async function readRange(path: string, options: ReadRangeOptions): Promise<Uint8Array> {
  const handle = await open(path, 'r')
  try {
    const buffer = new Uint8Array(options.length)
    const { bytesRead } = await handle.read(buffer, 0, options.length, options.position)
    return buffer.subarray(0, bytesRead)
  } finally {
    await handle.close()
  }
}

async function readNoFollow(
  path: string,
  maxBytes: number
): Promise<Result<Uint8Array, ReadNoFollowError>> {
  let handle: FileHandle | undefined

  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)

    const stats = await handle.stat()
    if (!stats.isFile()) return err({ reason: 'not-a-file' })
    if (stats.size > maxBytes) return err({ reason: 'too-large' })

    const bufferSize = maxBytes + 1
    const buffer = new Uint8Array(bufferSize)
    let totalRead = 0
    while (totalRead < bufferSize) {
      const { bytesRead } = await handle.read(buffer, totalRead, bufferSize - totalRead, totalRead)
      if (bytesRead === 0) break
      totalRead += bytesRead
    }
    if (totalRead === bufferSize) return err({ reason: 'too-large' })

    return ok(buffer.subarray(0, totalRead))
  } catch (error) {
    if (isMissingEntryError(error)) return err({ reason: 'missing' })
    if (errorCode(error) === 'ELOOP') return err({ reason: 'symlink' })
    throw error
  } finally {
    await handle?.close()
  }
}

/**
 * The {@link FileSystemPort} backed by Node's `fs` and `path`. Node's errors
 * pass through untouched, so their `code`s reach core as the port promises.
 */
export const nodeFileSystem: FileSystemPort = {
  async readDir(path) {
    const entries = await readdir(path, { withFileTypes: true })
    return entries.map((entry) => ({ name: entry.name, kind: kindOf(entry) }))
  },
  async lstat(path) {
    const stats = await lstat(path)
    return {
      kind: kindOf(stats),
      size: stats.size,
      mtimeMs: stats.mtimeMs,
      ino: stats.ino,
      dev: stats.dev
    }
  },
  readChunks,
  readRange,
  readNoFollow,
  realPath: (path) => realpath(path),
  readLink: (path) => readlink(path),
  joinPath: join,
  resolvePath: (path) => resolve(path)
}
