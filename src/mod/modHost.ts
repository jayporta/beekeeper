/** One entry of a directory, as the engine lists it. */
export interface HostEntry {
  /** The entry's name. */
  readonly name: string
  /** What the entry is. */
  readonly kind: 'file' | 'dir' | 'other'
  /** Size in bytes. */
  readonly size: number
  /** Modification time, in milliseconds since the epoch. */
  readonly mtimeMs: number
  /** Whether the entry is a symbolic link. */
  readonly isLink: boolean
}

/** What a path leads to, as the engine describes it. */
export interface HostStat {
  /** What the path leads to. */
  readonly kind: 'file' | 'dir' | 'other'
  /** Size in bytes. */
  readonly size: number
  /** Modification time, in milliseconds since the epoch. */
  readonly mtimeMs: number
  /** Whether the path itself is a symbolic link. */
  readonly isLink: boolean
  /** Where the path lands, absolute. */
  readonly realPath?: string
}

/** What the mod's logic may ask of the engine. `register.ts` builds one from `$` and is the only place that touches `$`. */
export interface ModHost {
  /** The engine's version: `$.session.version()`. */
  version(): Promise<{ readonly version: string; readonly base?: string }>
  /** A file's bytes: `$.fs.read(path, { as: 'bytes' })`, decoded. Rejects over 4 MiB. */
  readBytes(path: string): Promise<Uint8Array>
  /** A directory's entries: `$.fs.list(path)`. */
  list(path: string): Promise<readonly HostEntry[]>
  /** What a path leads to and where it lands: `$.fs.stat(path, { resolve: true })`. */
  stat(path: string): Promise<HostStat>
}
