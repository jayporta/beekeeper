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
import { collectBytes } from './collectBytes'
import { FS_READ_LIMIT } from './fsReadLimit'
import { joinPath, resolvePath } from './posixPath'
import { readThroughTail } from './readThroughTail'
import { portError, withPortError } from './toPortError'

const DEFAULT_CHUNK_SIZE = 64 * 1024

const KINDS = { file: 'file', dir: 'directory', other: 'other' } as const

/** The port's kind for something the engine describes: a symbolic link is its own kind. */
function kindOf(item: {
  readonly kind: keyof typeof KINDS
  readonly isLink: boolean
}): DirEntryKind {
  return item.isLink ? 'symlink' : KINDS[item.kind]
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
 * Reads go through `$.fs.read`, which returns a whole file up to {@link FS_READ_LIMIT}. A larger
 * file streams through `tail` (see {@link readThroughTail}) and must lie under the projects folder.
 * The engine reports no inode, so `lstat` answers `ino` and `dev` as 0. Rejections carry a code and
 * no engine text.
 *
 * @param options - The host; the session's working directory, which relative paths resolve
 * against; and the real path of the projects folder, which bounds the files read through `tail`.
 * @returns The adapter to install with `installFileSystem`.
 */
export function createModFileSystem(options: {
  host: ModHost
  cwd: string
  projectsRoot: string
}): FileSystemPort {
  const { host, cwd, projectsRoot } = options

  const throughTail = (path: string, start: number): AsyncGenerator<Uint8Array, void> =>
    readThroughTail({ host, projectsRoot, path, start })

  /** The bytes of a file whose size is known, read whole. */
  async function readSized(path: string, size: number): Promise<Uint8Array> {
    return size > FS_READ_LIMIT
      ? collectBytes(throughTail(path, 0), Infinity)
      : withPortError(host.readBytes(path))
  }

  async function* readChunks(
    path: string,
    { start, chunkSize }: ReadChunksOptions
  ): AsyncGenerator<Uint8Array> {
    assertOffset(start, 'start')
    const { size } = await withPortError(host.stat(path))
    if (size > FS_READ_LIMIT) {
      yield* throughTail(path, start)
      return
    }
    const step =
      chunkSize !== undefined && chunkSize > 0 ? Math.floor(chunkSize) : DEFAULT_CHUNK_SIZE
    const bytes = await withPortError(host.readBytes(path))
    for (let offset = start; offset < bytes.length; offset += step) {
      yield bytes.subarray(offset, offset + step)
    }
  }

  async function readRange(
    path: string,
    { position, length }: ReadRangeOptions
  ): Promise<Uint8Array> {
    assertOffset(position, 'position')
    assertOffset(length, 'length')
    const { size } = await withPortError(host.stat(path))
    if (size > FS_READ_LIMIT) {
      const bytes = await collectBytes(throughTail(path, position), length)
      return bytes.subarray(0, length)
    }
    return (await withPortError(host.readBytes(path))).subarray(position, position + length)
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
      const stat = await withPortError(host.stat(path))
      if (stat.isLink) return err({ reason: 'symlink' })
      if (stat.kind !== 'file') return err({ reason: 'not-a-file' })
      if (stat.size > maxBytes) return err({ reason: 'too-large' })
      const bytes = await readSized(path, stat.size)
      return bytes.length > maxBytes ? err({ reason: 'too-large' }) : ok(bytes)
    } catch (error) {
      if (isMissingEntryError(error)) return err({ reason: 'missing' })
      throw error
    }
  }

  async function lstat(path: string): Promise<FileStat> {
    const stat = await withPortError(host.stat(path))
    if (stat.isLink) return { kind: 'symlink', size: 0, mtimeMs: 0, ino: 0, dev: 0 }
    return { kind: kindOf(stat), size: stat.size, mtimeMs: stat.mtimeMs, ino: 0, dev: 0 }
  }

  async function realPath(path: string): Promise<string> {
    const { realPath: landed } = await withPortError(host.stat(path))
    if (landed === undefined) throw portError('ENOENT')
    return landed
  }

  /** The link's resolved target: the engine never reports the target text itself. */
  async function readLink(path: string): Promise<string> {
    const stat: HostStat = await withPortError(host.stat(path))
    if (!stat.isLink) throw portError('EINVAL')
    if (stat.realPath === undefined) throw portError('ENOENT')
    return stat.realPath
  }

  return {
    readDir: async (path) =>
      (await withPortError(host.list(path))).map((entry) => ({
        name: entry.name,
        kind: kindOf(entry)
      })),
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
