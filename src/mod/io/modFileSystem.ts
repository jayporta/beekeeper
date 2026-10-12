import type {
  DirEntryKind,
  FileStat,
  FileSystemPort,
  ReadChunksOptions,
  ReadNoFollowError,
  ReadRangeOptions
} from '../../core/io/fileSystemPort'
import { isMissingEntryError } from '../../core/shared/isMissingEntryError'
import { err, ok, type Result } from '../../core/shared/result'
import type { HostStat, ModHost } from '../modHost'
import { FS_READ_LIMIT } from './fsReadLimit'
import { joinPath, resolvePath } from './posixPath'
import { portError, toPortError } from './toPortError'

const DEFAULT_CHUNK_SIZE = 64 * 1024

const KINDS = { file: 'file', dir: 'directory', other: 'other' } as const

/** The port's kind for something the engine describes: a symbolic link is its own kind. */
function kindOf(item: {
  readonly kind: keyof typeof KINDS
  readonly isLink: boolean
}): DirEntryKind {
  return item.isLink ? 'symlink' : KINDS[item.kind]
}

/** Awaits an engine call, rejecting with a port error in place of the engine's. */
async function guarded<T>(call: Promise<T>): Promise<T> {
  try {
    return await call
  } catch (error) {
    throw toPortError(error)
  }
}

/**
 * The bytes of a file whose size is known, read whole.
 *
 * Files over {@link FS_READ_LIMIT} reject with `EFBIG`: `$.fs.read` can't return them.
 */
async function readSized(host: ModHost, path: string, size: number): Promise<Uint8Array> {
  if (size > FS_READ_LIMIT) throw portError('EFBIG')
  return guarded(host.readBytes(path))
}

/** The bytes of a file, after asking its size. */
async function readWhole(host: ModHost, path: string): Promise<Uint8Array> {
  const { size } = await guarded(host.stat(path))
  return readSized(host, path, size)
}

/** Rejects unless `value` is a non-negative integer. */
function assertOffset(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer`)
  }
}

/**
 * A {@link FileSystemPort} over the engine's `$.fs`, through a {@link ModHost}.
 *
 * Reads go through `$.fs.read`, which returns a whole file up to {@link FS_READ_LIMIT}; a larger
 * file rejects with `EFBIG`. The engine reports no inode, so `lstat` answers `ino` and `dev` as 0.
 * Rejections carry a code and no engine text.
 *
 * @param options - The host, and the session's working directory that relative paths resolve against.
 * @returns The adapter to install with `installFileSystem`.
 */
export function createModFileSystem(options: { host: ModHost; cwd: string }): FileSystemPort {
  const { host, cwd } = options

  async function* readChunks(
    path: string,
    { start, chunkSize }: ReadChunksOptions
  ): AsyncGenerator<Uint8Array> {
    assertOffset(start, 'start')
    const size =
      chunkSize !== undefined && chunkSize > 0 ? Math.floor(chunkSize) : DEFAULT_CHUNK_SIZE
    const bytes = await readWhole(host, path)
    for (let offset = start; offset < bytes.length; offset += size) {
      yield bytes.subarray(offset, offset + size)
    }
  }

  async function readRange(
    path: string,
    { position, length }: ReadRangeOptions
  ): Promise<Uint8Array> {
    assertOffset(position, 'position')
    assertOffset(length, 'length')
    return (await readWhole(host, path)).subarray(position, position + length)
  }

  /**
   * Checks, then reads: a file swapped between the two isn't caught. The port allows this for
   * adapters without file handles.
   */
  async function readNoFollow(
    path: string,
    maxBytes: number
  ): Promise<Result<Uint8Array, ReadNoFollowError>> {
    try {
      const stat = await guarded(host.stat(path))
      if (stat.isLink) return err({ reason: 'symlink' })
      if (stat.kind !== 'file') return err({ reason: 'not-a-file' })
      if (stat.size > maxBytes) return err({ reason: 'too-large' })
      const bytes = await readSized(host, path, stat.size)
      return bytes.length > maxBytes ? err({ reason: 'too-large' }) : ok(bytes)
    } catch (error) {
      if (isMissingEntryError(error)) return err({ reason: 'missing' })
      throw error
    }
  }

  async function lstat(path: string): Promise<FileStat> {
    const stat = await guarded(host.stat(path))
    if (stat.isLink) return { kind: 'symlink', size: 0, mtimeMs: 0, ino: 0, dev: 0 }
    return { kind: kindOf(stat), size: stat.size, mtimeMs: stat.mtimeMs, ino: 0, dev: 0 }
  }

  async function realPath(path: string): Promise<string> {
    const { realPath: landed } = await guarded(host.stat(path))
    if (landed === undefined) throw portError('ENOENT')
    return landed
  }

  /** The link's resolved target: the engine never reports the target text itself. */
  async function readLink(path: string): Promise<string> {
    const stat: HostStat = await guarded(host.stat(path))
    if (!stat.isLink) throw portError('EINVAL')
    if (stat.realPath === undefined) throw portError('ENOENT')
    return stat.realPath
  }

  return {
    readDir: async (path) =>
      (await guarded(host.list(path))).map((entry) => ({ name: entry.name, kind: kindOf(entry) })),
    lstat,
    readChunks,
    readRange,
    readNoFollow,
    realPath,
    readLink,
    joinPath,
    resolvePath: (path) => resolvePath(path, cwd)
  }
}
