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
import { portError, toPortError, withPortError } from './toPortError'
import { createWholeFileCache } from './wholeFileCache'

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
 * The last file read whole is kept, so a transcript read in several calls crosses the engine once
 * while it is unchanged (its size and modification time are the same).
 * The engine reports no inode, so `lstat` answers `ino` and `dev` as 0. Rejections carry a code and
 * no engine text.
 *
 * @param options - The host; the session's working directory, which relative paths resolve
 * against; the projects folder, which bounds the files read through `tail`; and whether that path is
 * its real path (false when the folder was absent at startup).
 * @returns The adapter to install with `installFileSystem`.
 */
export function createModFileSystem(options: {
  host: ModHost
  cwd: string
  projectsRoot: string
  isProjectsRootResolved: boolean
}): FileSystemPort {
  const { host, cwd } = options
  let projectsRoot = options.projectsRoot
  let isRootResolved = options.isProjectsRootResolved

  const cache = createWholeFileCache()

  /**
   * The projects folder's real path. A folder that was absent at startup may sit behind a link, so it
   * is resolved again on a tail read, and kept once it resolves.
   */
  async function resolvedRoot(): Promise<string> {
    if (!isRootResolved) {
      try {
        projectsRoot = (await host.stat(projectsRoot)).realPath ?? projectsRoot
        isRootResolved = true
      } catch (error) {
        const failure = toPortError(error)
        // Still absent: confine against the path as it stands.
        if (!isMissingEntryError(failure)) throw failure
      }
    }
    return projectsRoot
  }

  async function* throughTail(stat: HostStat, start: number): AsyncGenerator<Uint8Array, void> {
    yield* readThroughTail({
      host,
      projectsRoot: await resolvedRoot(),
      realPath: stat.realPath,
      start
    })
  }

  /** The bytes of a file, whole, from the last read when the file hasn't changed since. */
  async function readWhole(path: string, stat: HostStat): Promise<Uint8Array> {
    if (stat.size > FS_READ_LIMIT) return collectBytes(throughTail(stat, 0), Infinity)
    const key = stat.realPath ?? path
    const cached = cache.get(key, stat)
    if (cached !== undefined) return cached
    const bytes = await withPortError(host.readBytes(path))
    cache.set({ path: key, size: stat.size, mtimeMs: stat.mtimeMs, bytes })
    return bytes
  }

  async function* readChunks(
    path: string,
    { start, chunkSize }: ReadChunksOptions
  ): AsyncGenerator<Uint8Array> {
    assertOffset(start, 'start')
    const stat = await withPortError(host.stat(path))
    if (stat.size > FS_READ_LIMIT) {
      yield* throughTail(stat, start)
      return
    }
    const floored = Math.floor(chunkSize ?? 0)
    const step = floored >= 1 ? floored : DEFAULT_CHUNK_SIZE
    const bytes = await readWhole(path, stat)
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
    const stat = await withPortError(host.stat(path))
    if (stat.size > FS_READ_LIMIT) {
      const bytes = await collectBytes(throughTail(stat, position), length)
      return bytes.subarray(0, length)
    }
    return (await readWhole(path, stat)).subarray(position, position + length)
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
      const bytes = await readWhole(path, stat)
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
