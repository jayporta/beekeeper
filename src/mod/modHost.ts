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

/** One decoded piece of a spawned child's output. */
export interface HostTailChunk {
  /** The pipe the text came from. */
  readonly stream: 'stdout' | 'stderr'
  /** What the child wrote, decoded as UTF-8. */
  readonly text: string
}

/** How a spawned child ended. */
export interface HostTailResult {
  /** The exit status; null when a signal ended it. */
  readonly code: number | null
  /** The signal that ended it; null when it exited on its own. */
  readonly signal: string | null
}

/** One git run, or one of locateGit's macOS probes. */
export interface HostRunRequest {
  /** Absolute path of the program. */
  readonly file: string
  /** Arguments after the program. */
  readonly args: readonly string[]
  /** Variables set over the engine's inherited environment. */
  readonly env: Readonly<Record<string, string>>
  /** Milliseconds before the child is killed. */
  readonly timeoutMs: number
}

/** The fields of a finished run the process port uses. */
export interface HostRunResult {
  /** The child's exit status. */
  readonly exitCode: number
  /** Standard output as text, capped at 4 MiB. */
  readonly stdout: string
  /** Whether `stdout` was cut at the cap. */
  readonly isStdoutTruncated: boolean
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
  /**
   * A file's text from byte `start` on: `$.process.spawn({ argv: ['tail', '-c', '+<start + 1>', path] })`.
   * Throws unless `start` is a non-negative safe integer and `path` is absolute. Ending the
   * iteration early kills the child. Only `readThroughTail` calls it, after confining `path`.
   */
  tail(path: string, start: number): AsyncGenerator<HostTailChunk, HostTailResult>
  /** Runs git, or one of locateGit's macOS probes: `$.process.run([request.file, ...request.args], { env, timeoutMs })`. Rejects any other argv. */
  runGit(request: HostRunRequest): Promise<HostRunResult>
  /** `uname -s`'s output: `$.process.run(['uname', '-s'])`. */
  osName(): Promise<string>
  /** `CLAUDE_CONFIG_DIR`, or undefined: `$.env.get('CLAUDE_CONFIG_DIR')`. */
  configDir(): Promise<string | undefined>
  /** `HOME`, or undefined: `$.env.get('HOME')`. */
  home(): Promise<string | undefined>
  /** Names of the inherited git repository variables that are set, each read with its own `$.env.get('<literal>')`. */
  gitRepoVariablesSet(): Promise<readonly string[]>
}
