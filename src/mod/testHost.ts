import type { HostEntry, HostStat, ModHost } from './modHost'

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
}

/**
 * Builds a fake `ModHost` for tests.
 *
 * @param answers - Overrides for what the fake answers.
 * @returns The fake host.
 */
export function createTestHost(answers: TestHostAnswers = {}): ModHost {
  const { version = { version: '2.1.296', base: '2.1.296' }, paths = {}, failures = {} } = answers
  const lookup = (path: string): TestPath => {
    if (path in failures) throw failures[path]
    const found = paths[path]
    if (found === undefined) throw Object.assign(new Error('no such file'), { code: 'ENOENT' })
    return found
  }
  return {
    version: async () => (typeof version === 'function' ? version() : version),
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
    stat: async (path): Promise<HostStat> => {
      const found = lookup(path)
      return {
        kind: found.kind,
        size: found.kind === 'file' ? (found.size ?? found.bytes?.length ?? 0) : 0,
        mtimeMs: 1000,
        isLink: found.isLink ?? false,
        realPath: found.realPath ?? path
      }
    }
  }
}
