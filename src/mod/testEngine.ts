import type { Elements, Engine, FsStat, ProcessRunResult, SessionVersion } from 'claude-code'

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
  /** The timers `$.clock.after` and `$.clock.every` started, in order. */
  readonly timers: FakeTimer[]
  /** Empties the `$.state` values, as a `/clear` does. */
  readonly clearState: () => void
}

/** A timer the fake clock holds until a test fires it. */
export interface FakeTimer {
  /** `after` or `every`. */
  readonly kind: 'after' | 'every'
  /** The wait in milliseconds. */
  readonly ms: number
  /** What the timer calls. */
  readonly fn: () => void
  /** Whether it was cancelled. */
  cancelled: boolean
}

/** What the fake `$` answers; each field has a default. */
export interface TestEngineAnswers {
  /** The engine version `$.session.version()` reports. */
  version?: SessionVersion
  /** The environment variables `$.env.get` reads; `HOME` defaults to `/home/u`. */
  env?: Record<string, string>
  /** Whether `$.ui.open` places the pane; true by default. */
  isPlaced?: boolean
  /** The ids of the panes `$.ui.panes()` lists; none by default. */
  panes?: readonly string[]
  /** The `$.state` values to start with, by `plugin.key`. */
  state?: Record<string, unknown>
  /** What `$.session.id()` answers. */
  sessionId?: string
  /** What `$.session.root()` answers. */
  sessionRoot?: string
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

/** The elements the fake `$.ui.resolve` hands out: the same functions on every call, so a test can find them in a tree. */
export const TEST_ELEMENTS: Elements = {
  Box: () => ({}),
  Text: () => ({}),
  Button: () => ({}),
  Code: () => ({})
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
  const timers: FakeTimer[] = []
  const stored: Record<string, unknown> = { ...answers.state }
  const startTimer = (
    kind: FakeTimer['kind'],
    ms: number,
    fn: () => void
  ): { cancel: () => void } => {
    record(`clock.${kind}`, ms)
    const timer: FakeTimer = { kind, ms, fn, cancelled: false }
    timers.push(timer)
    return {
      cancel: () => {
        timer.cancelled = true
      }
    }
  }
  const record = (name: string, ...args: unknown[]): void => {
    calls.push({ name, args })
  }
  const $: Engine = {
    session: {
      version: async () => {
        record('session.version')
        if (answers.versionFails) throw new Error('version unavailable')
        return answers.version ?? { version: '2.1.296', base: '2.1.296' }
      },
      id: async () => {
        record('session.id')
        return answers.sessionId ?? '11111111-1111-4111-8111-111111111111'
      },
      root: async () => {
        record('session.root')
        return answers.sessionRoot ?? '/work'
      }
    },
    clock: {
      now: async () => {
        record('clock.now')
        return 1000
      },
      after: (ms, fn) => startTimer('after', ms, fn),
      every: (ms, fn) => startTimer('every', ms, fn)
    },
    state: {
      get: async <T>(ref: { plugin: string; key: string }) => {
        record('state.get', ref)
        return { value: stored[`${ref.plugin}.${ref.key}`] as T | undefined, version: 1 }
      },
      set: async (ref, value) => {
        record('state.set', ref, value)
        stored[`${ref.plugin}.${ref.key}`] = value
        return { isSet: true }
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
        return TEST_ELEMENTS
      },
      panes: async () => {
        record('ui.panes')
        return (answers.panes ?? []).map((id) => ({ id }))
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
  return {
    $,
    calls,
    timers,
    clearState: () => {
      for (const key of Object.keys(stored)) delete stored[key]
    }
  }
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
