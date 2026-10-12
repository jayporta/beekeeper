import type {
  HostEntry,
  HostRunResult,
  HostStat,
  HostTailChunk,
  HostTailResult,
  ModHost
} from './modHost'

/** One path in the fake host's file system. */
export type TestPath =
  | {
      /** A regular file. */
      readonly kind: 'file'
      /** The file's content; `size` defaults to its length. */
      readonly bytes?: Uint8Array
      /** The size to report, for a file too big to build. */
      readonly size?: number
      /** Whether the path is a symbolic link. */
      readonly isLink?: boolean
      /** Where the path lands; defaults to the path itself. */
      readonly realPath?: string
      /** The modification time to report; defaults to 1000. */
      readonly mtimeMs?: number
      /** The exit status `tail` ends with; defaults to 0. */
      readonly tailExitCode?: number
    }
  | {
      /** A directory or anything else that is not a regular file. */
      readonly kind: 'dir' | 'other'
      /** The entries `list` answers, for a directory. */
      readonly entries?: readonly HostEntry[]
      /** Whether the path is a symbolic link. */
      readonly isLink?: boolean
      /** Where the path lands; defaults to the path itself. */
      readonly realPath?: string
    }

/** What the fake host answers; each field has a default. */
export interface TestHostAnswers {
  /** What `version()` resolves to, or a function that throws to simulate a failure. */
  version?: Awaited<ReturnType<ModHost['version']>> | (() => never)
  /** The fake file system, by absolute path. A path that is not here is missing (`ENOENT`). */
  paths?: Readonly<Record<string, TestPath>>
  /** What a call on a path throws instead of answering, as an engine rejection would. */
  failures?: Readonly<Record<string, unknown>>
  /** The environment variables the host can read; `HOME` defaults to `/home/u`. */
  env?: Readonly<Record<string, string>>
  /** What `uname -s` prints, or a function that throws to simulate a missing `uname`. */
  os?: string | (() => never)
  /** The git repository variables that are set. */
  gitRepoVariables?: readonly string[]
  /** What a git run answers; defaults to an empty success. */
  git?: HostRunResult
}

/** How many characters of a file the fake `tail` hands out at a time. */
const TAIL_PIECE = 3

/**
 * Builds a fake `ModHost` for tests.
 *
 * @param answers - Overrides for what the fake answers.
 * @returns The fake host.
 */
export function createTestHost(answers: TestHostAnswers = {}): ModHost {
  const {
    version = { version: '2.1.296', base: '2.1.296' },
    paths = {},
    failures = {},
    env = { HOME: '/home/u' },
    os = 'Darwin\n',
    gitRepoVariables = [],
    git = { exitCode: 0, stdout: '', isStdoutTruncated: false }
  } = answers
  const lookup = (path: string): TestPath => {
    if (path in failures) throw failures[path]
    const found = paths[path]
    if (found === undefined) throw Object.assign(new Error('no such file'), { code: 'ENOENT' })
    return found
  }
  return {
    version: async () => (typeof version === 'function' ? version() : version),
    runGit: async () => git,
    osName: async () => (typeof os === 'function' ? os() : os),
    configDir: async () => env['CLAUDE_CONFIG_DIR'],
    home: async () => env['HOME'],
    gitRepoVariablesSet: async () => gitRepoVariables,
    readBytes: async (path) => {
      const found = lookup(path)
      if (found.kind !== 'file')
        throw Object.assign(new Error('is a directory'), { code: 'EISDIR' })
      return found.bytes ?? new Uint8Array(found.size ?? 0)
    },
    list: async (path) => {
      const found = lookup(path)
      if (found.kind !== 'dir')
        throw Object.assign(new Error('not a directory'), { code: 'ENOTDIR' })
      return found.entries ?? []
    },
    tail: async function* (path, start): AsyncGenerator<HostTailChunk, HostTailResult> {
      const found = lookup(path)
      if (found.kind !== 'file') return { code: 1, signal: null }
      const text = new TextDecoder().decode((found.bytes ?? new Uint8Array(0)).subarray(start))
      for (let offset = 0; offset < text.length; offset += TAIL_PIECE) {
        yield { stream: 'stdout', text: text.slice(offset, offset + TAIL_PIECE) }
      }
      return { code: found.tailExitCode ?? 0, signal: null }
    },
    stat: async (path): Promise<HostStat> => {
      const found = lookup(path)
      return {
        kind: found.kind,
        size: found.kind === 'file' ? (found.size ?? found.bytes?.length ?? 0) : 0,
        mtimeMs: found.kind === 'file' ? (found.mtimeMs ?? 1000) : 1000,
        isLink: found.isLink ?? false,
        realPath: found.realPath ?? path
      }
    }
  }
}
