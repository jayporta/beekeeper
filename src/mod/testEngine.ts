import type { Engine, FsStat, ProcessRunResult, SessionVersion } from 'claude-code'

/** One call the test engine recorded: the dotted name (`ui.open`) and its arguments. */
export interface RecordedCall {
  readonly name: string
  readonly args: readonly unknown[]
}

/** A fake `$` and the calls made on it. */
export interface TestEngine {
  /** The fake `$`, to pass to a hook. */
  readonly $: Engine
  /** Every call made on `$`, in order. */
  readonly calls: RecordedCall[]
}

/** What the fake `$` answers; each field has a default. */
export interface TestEngineAnswers {
  /** The engine version `$.session.version()` reports. */
  version?: SessionVersion
  /** The environment variables `$.env.get` reads; `HOME` defaults to `/home/u`. */
  env?: Record<string, string>
  /** Whether `$.ui.open` places the pane; true by default. */
  isPlaced?: boolean
  /** Makes `$.session.version()` reject, as an engine that can't report its version would. */
  versionFails?: boolean
}

const EMPTY_RUN: ProcessRunResult = {
  exitCode: 0,
  stdout: '',
  stderr: '',
  isStdoutTruncated: false,
  isStderrTruncated: false
}

const EMPTY_STAT: FsStat = { kind: 'file', size: 0, mtimeMs: 0, isLink: false }

/**
 * Builds a hand-rolled `$` that records every call and answers from `answers`.
 *
 * @param answers - Overrides for what the fake answers.
 * @returns The fake `$` and its call log.
 */
export function createTestEngine(answers: TestEngineAnswers = {}): TestEngine {
  const calls: RecordedCall[] = []
  const record = (name: string, ...args: unknown[]): void => {
    calls.push({ name, args })
  }
  const $: Engine = {
    session: {
      version: async () => {
        record('session.version')
        if (answers.versionFails) throw new Error('version unavailable')
        return answers.version ?? { version: '2.1.296', base: '2.1.296' }
      }
    },
    command: {
      register: async (spec) => {
        record('command.register', spec)
        return undefined
      }
    },
    ui: {
      open: async (pane) => {
        record('ui.open', pane)
        return { isPlaced: answers.isPlaced ?? true }
      },
      resolve: (e) => {
        record('ui.resolve', e)
        return {
          Box: () => ({}),
          Text: () => ({})
        }
      },
      status: (text) => {
        record('ui.status', text)
      }
    },
    env: {
      get: async (name) => {
        record('env.get', name)
        return (answers.env ?? { HOME: '/home/u' })[name]
      }
    },
    fs: {
      read: async (path, options) => {
        record('fs.read', path, options)
        return { base64: '' }
      },
      list: async (path) => {
        record('fs.list', path)
        return []
      },
      stat: async (path, options) => {
        record('fs.stat', path, options)
        return EMPTY_STAT
      }
    },
    process: {
      run: async (argv, init) => {
        record('process.run', argv, init)
        return EMPTY_RUN
      },
      // eslint-disable-next-line require-yield -- a stream that ends at once
      spawn: async function* (request) {
        record('process.spawn', request)
        return { code: 0, signal: null }
      }
    }
  }
  return { $, calls }
}

/**
 * Builds a `$` whose every method throws, as an engine that is down would: the call fails before it
 * returns, which an `await` in an async hook sees the same as a rejection.
 *
 * @returns The failing `$`.
 */
export function createFailingEngine(): Engine {
  const fail = (): never => {
    throw new Error('engine unavailable')
  }
  const noun = new Proxy({}, { get: () => fail })
  return new Proxy({}, { get: () => noun }) as Engine
}
