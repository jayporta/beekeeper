/** What a stat says about a file, enough to tell whether it changed. */
export interface FileVersion {
  /** Size in bytes. */
  readonly size: number
  /** Modification time, in milliseconds since the epoch. */
  readonly mtimeMs: number
}

/** The one file a {@link WholeFileCache} holds. */
interface CachedFile extends FileVersion {
  readonly path: string
  readonly bytes: Uint8Array
}

/** Remembers the last file read whole. */
export interface WholeFileCache {
  /**
   * The remembered bytes, when they are of this path at this version.
   *
   * @param path - The file's path.
   * @param version - The file's size and modification time now.
   * @returns The bytes, which are shared: callers must not modify them. Undefined on a miss.
   */
  get(path: string, version: FileVersion): Uint8Array | undefined
  /**
   * Remembers a file's bytes in place of the last one.
   *
   * @param file - The path, the version it was read at, and its bytes.
   */
  set(file: CachedFile): void
}

/**
 * Builds a cache of one entry. Core reads a transcript in several calls (a range for its tail, then
 * chunks, then the rest), and each would otherwise move the whole file over the engine again.
 *
 * @returns An empty cache.
 */
export function createWholeFileCache(): WholeFileCache {
  let last: CachedFile | undefined
  return {
    get: (path, { size, mtimeMs }) =>
      last?.path === path && last.size === size && last.mtimeMs === mtimeMs
        ? last.bytes
        : undefined,
    set: (file) => {
      last = file
    }
  }
}
