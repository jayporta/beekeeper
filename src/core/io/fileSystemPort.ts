import type { Result } from '../shared/result'

/** What a directory entry is, without following a symbolic link. */
export type DirEntryKind = 'file' | 'directory' | 'symlink' | 'other'

/** One entry of a directory listing. */
export interface DirEntry {
  /** The entry's name, never a path. */
  readonly name: string
  /** What the entry itself is; a symbolic link is `symlink`, whatever it points at. */
  readonly kind: DirEntryKind
}

/** A path's own metadata, as `lstat` reports it. */
export interface FileStat {
  /** What the path itself is; a symbolic link is `symlink`. */
  readonly kind: DirEntryKind
  /** Size in bytes. */
  readonly size: number
  /** Last-modified time, in milliseconds since the Unix epoch. */
  readonly mtimeMs: number
  /** Inode number, or 0 when the adapter can't tell (with `dev` 0 too). */
  readonly ino: number
  /** Device id, or 0 when the adapter can't tell (with `ino` 0 too). */
  readonly dev: number
}

/** Options for {@link FileSystemPort.readChunks}. */
export interface ReadChunksOptions {
  /** The byte offset to start at. */
  readonly start: number
  /** A preferred chunk size in bytes; the adapter may ignore it. */
  readonly chunkSize?: number
}

/** Options for {@link FileSystemPort.readRange}. */
export interface ReadRangeOptions {
  /** The byte offset to read from. */
  readonly position: number
  /** The most bytes to read. */
  readonly length: number
}

/** Why {@link FileSystemPort.readNoFollow} returned no bytes. */
export interface ReadNoFollowError {
  /** The refusal: absent, a symlink, not a regular file, or past the byte cap. */
  readonly reason: 'missing' | 'symlink' | 'not-a-file' | 'too-large'
}

/**
 * Everything core reads from disk. Read-only by design: there is no write.
 *
 * Errors: every method rejects with an `Error` carrying a Node-style `code`
 * (`ENOENT`, `ENOTDIR`, `EACCES`, ...) for an OS refusal, so core's
 * `isMissingEntryError` works on any adapter.
 */
export interface FileSystemPort {
  /**
   * Lists a directory's entries, without following links.
   * @param path - The directory to list.
   * @returns The entries, in no particular order.
   * @throws {Error} With code `ENOENT` or `ENOTDIR` when it isn't a directory.
   */
  readDir(path: string): Promise<readonly DirEntry[]>

  /**
   * Stats the path itself, without following a link.
   * @param path - The path to stat.
   * @returns The path's own metadata.
   * @throws {Error} With code `ENOENT` when the path is missing.
   */
  lstat(path: string): Promise<FileStat>

  /**
   * Streams a file's bytes from `start`; closing the iterator early closes the file.
   * @param path - The file to read.
   * @param options - The start offset and a preferred chunk size.
   * @returns The file's bytes in order. The first pull rejects when the file can't be opened.
   */
  readChunks(path: string, options: ReadChunksOptions): AsyncIterable<Uint8Array>

  /**
   * Reads up to `length` bytes at `position`, fewer at the end of the file.
   * @param path - The file to read.
   * @param options - The byte offset and the most bytes to read.
   * @returns The bytes read; empty at or past the end of the file.
   */
  readRange(path: string, options: ReadRangeOptions): Promise<Uint8Array>

  /**
   * Reads a whole small file. Required of every adapter: a symlink at the
   * last component is `symlink`, never followed; a non-regular file
   * (directory, FIFO, device) is `not-a-file`, reported without blocking on
   * it; no more than `maxBytes` bytes are returned, and a larger file is
   * `too-large`. The Node adapter also makes every check against one open
   * file descriptor (`O_NOFOLLOW | O_NONBLOCK`, `fstat`, positional reads),
   * so nothing can change between check and read; an adapter without file
   * handles (the mod) checks, then reads, and documents that race.
   * @param path - The file to read.
   * @param maxBytes - The largest file size, in bytes, that is returned.
   * @returns `ok` with the file's bytes, or an `err` saying why there are none.
   */
  readNoFollow(path: string, maxBytes: number): Promise<Result<Uint8Array, ReadNoFollowError>>

  /**
   * Resolves every symbolic link in a path, like `realpath(3)`.
   * @param path - The path to resolve.
   * @returns The absolute path with no link left in it.
   * @throws {Error} With code `ENOENT` when a component is missing.
   */
  realPath(path: string): Promise<string>

  /**
   * Reads a symbolic link's target text, unresolved.
   * @param path - The link to read.
   * @returns The target as written, relative or absolute.
   * @throws {Error} With code `EINVAL` when the path is not a link, `ENOENT` when missing.
   */
  readLink(path: string): Promise<string>

  /**
   * Joins path segments the platform's way (`node:path` `join`).
   * @param segments - The segments to join.
   * @returns The joined path.
   */
  joinPath(...segments: string[]): string

  /**
   * Resolves a path to an absolute one the platform's way (`node:path` `resolve`).
   * @param path - The path to resolve.
   * @returns The absolute path.
   */
  resolvePath(path: string): string
}
