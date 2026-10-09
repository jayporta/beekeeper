import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { IPC_EVENTS } from '../../../shared/ipc/channels'
import { errorWithCode } from '../../testErrorWithCode'
import { LIVE_UPDATE_INTERVAL_MS } from '../changeBatcher'
import {
  createProjectsWatcher,
  ROOT_RETRY_INTERVAL_MS,
  type ProjectsWatcher,
  type ProjectsWatcherOptions,
  type WatcherLike
} from '../createProjectsWatcher'
import { fakeWindow, type FakeWindow } from '../testFakeWindow'

const ROOT = '/Users/someone/.claude/projects'

interface FakeWatch {
  readonly watch: Mock<ProjectsWatcherOptions['watch']>
  /** Each watcher the fake handed out, oldest first. */
  readonly watchers: FakeWatcher[]
}

interface FakeWatcher extends WatcherLike {
  readonly close: Mock<() => void>
  /** Emits a watch event as the filesystem would. */
  emit(filename: string | null): void
  /** Emits an `error` event. */
  fail(error: unknown): void
}

/** A `watch` stub: each entry of `script` is an error to throw, or `null` to return a watcher. */
function fakeWatch(script: readonly (Error | null)[] = [null]): FakeWatch {
  const watchers: FakeWatcher[] = []
  let call = 0
  const watch = vi.fn<ProjectsWatcherOptions['watch']>((_root, _options, listener) => {
    const step = script[Math.min(call++, script.length - 1)]
    if (step) throw step
    let onError: (error: unknown) => void = () => undefined
    const watcher: FakeWatcher = {
      on: (_event, handler) => {
        onError = handler
      },
      close: vi.fn<() => void>(),
      emit: (filename) => {
        listener('change', filename)
      },
      fail: (error) => {
        onError(error)
      }
    }
    watchers.push(watcher)
    return watcher
  })
  return { watch, watchers }
}

/** A watcher that has not started watching yet. */
function create(
  fake: FakeWatch,
  windows: readonly FakeWindow[],
  exists: () => boolean = () => true
): ProjectsWatcher {
  return createProjectsWatcher({
    root: ROOT,
    watch: fake.watch,
    exists,
    windows: () => windows.map((w) => w.window)
  })
}

/** A watcher that has started. */
function start(
  fake: FakeWatch,
  windows: readonly FakeWindow[],
  exists: () => boolean = () => true
): ProjectsWatcher {
  const watcher = create(fake, windows, exists)
  watcher.start()
  return watcher
}

const batchesOf = (window: FakeWindow): unknown[] =>
  window.send.mock.calls.filter(([channel]) => channel === IPC_EVENTS.filesChanged).map((c) => c[1])
const unavailableCount = (window: FakeWindow): number =>
  window.send.mock.calls.filter(([channel]) => channel === IPC_EVENTS.liveUpdatesUnavailable).length

describe('createProjectsWatcher', () => {
  let warn: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.useFakeTimers()
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })
  afterEach(() => {
    vi.useRealTimers()
    warn.mockRestore()
  })

  describe('start', () => {
    it('watches nothing until it is started', () => {
      const fake = fakeWatch()
      create(fake, [])
      vi.advanceTimersByTime(ROOT_RETRY_INTERVAL_MS)
      expect(fake.watch).not.toHaveBeenCalled()
    })

    it('does not watch twice when started twice', () => {
      const fake = fakeWatch()
      const watcher = create(fake, [])
      watcher.start()
      watcher.start()
      expect(fake.watch).toHaveBeenCalledTimes(1)
    })

    it('does not watch twice when started again while waiting for the root', () => {
      const fake = fakeWatch([errorWithCode('ENOENT'), null])
      const watcher = create(fake, [])
      watcher.start()
      watcher.start()
      expect(fake.watch).toHaveBeenCalledTimes(1)
    })

    it('does nothing when started after it is closed', () => {
      const fake = fakeWatch()
      const watcher = create(fake, [])
      watcher.close()
      watcher.start()
      expect(fake.watch).not.toHaveBeenCalled()
    })

    it('does not restart after becoming unavailable', () => {
      const fake = fakeWatch([errorWithCode('EMFILE'), null])
      const watcher = create(fake, [])
      watcher.start()
      watcher.start()
      expect(fake.watch).toHaveBeenCalledTimes(1)
    })
  })

  it('watches the root recursively', () => {
    const fake = fakeWatch()
    start(fake, [])
    expect(fake.watch).toHaveBeenCalledWith(ROOT, { recursive: true }, expect.any(Function))
  })

  it('sends one batch to a live window once the interval has passed', () => {
    const fake = fakeWatch()
    const live = fakeWindow()
    start(fake, [live])
    fake.watchers[0]?.emit('-Users-a/one.jsonl')
    fake.watchers[0]?.emit('-Users-b/two.jsonl')
    vi.advanceTimersByTime(LIVE_UPDATE_INTERVAL_MS)
    expect(batchesOf(live)).toEqual([
      { dirNames: ['-Users-a', '-Users-b'], foldersChanged: false, all: false }
    ])
  })

  it('skips destroyed and loading windows when sending a batch', () => {
    const fake = fakeWatch()
    const gone = fakeWindow({ destroyed: true })
    const loading = fakeWindow({ loading: true })
    const live = fakeWindow()
    start(fake, [gone, loading, live])
    fake.watchers[0]?.emit('-Users-a/one.jsonl')
    vi.advanceTimersByTime(LIVE_UPDATE_INTERVAL_MS)
    expect(gone.send).not.toHaveBeenCalled()
    expect(loading.send).not.toHaveBeenCalled()
    expect(batchesOf(live)).toHaveLength(1)
  })

  it('widens a batch to all for an event it cannot map to a folder while the root exists', () => {
    const fake = fakeWatch()
    const live = fakeWindow()
    start(fake, [live])
    fake.watchers[0]?.emit(null)
    vi.advanceTimersByTime(LIVE_UPDATE_INTERVAL_MS)
    expect(batchesOf(live)).toEqual([{ dirNames: [], foldersChanged: false, all: true }])
    expect(fake.watchers[0]?.close).not.toHaveBeenCalled()
  })

  describe('a missing root', () => {
    it('waits and tells no window when the root is missing at start', () => {
      const fake = fakeWatch([errorWithCode('ENOENT'), null])
      const live = fakeWindow()
      start(fake, [live])
      vi.advanceTimersByTime(ROOT_RETRY_INTERVAL_MS - 1)
      expect(fake.watch).toHaveBeenCalledTimes(1)
      expect(live.send).not.toHaveBeenCalled()
    })

    it('retries after the interval and then delivers events', () => {
      const fake = fakeWatch([errorWithCode('ENOENT'), null])
      const live = fakeWindow()
      start(fake, [live])
      vi.advanceTimersByTime(ROOT_RETRY_INTERVAL_MS)
      expect(fake.watch).toHaveBeenCalledTimes(2)
      vi.advanceTimersByTime(LIVE_UPDATE_INTERVAL_MS)
      live.send.mockClear()
      fake.watchers[0]?.emit('-Users-a/one.jsonl')
      vi.advanceTimersByTime(LIVE_UPDATE_INTERVAL_MS)
      expect(batchesOf(live)).toEqual([
        { dirNames: ['-Users-a'], foldersChanged: false, all: false }
      ])
    })

    it('tells windows to refresh everything once the root appears', () => {
      const fake = fakeWatch([errorWithCode('ENOENT'), null])
      const live = fakeWindow()
      start(fake, [live])
      vi.advanceTimersByTime(ROOT_RETRY_INTERVAL_MS + LIVE_UPDATE_INTERVAL_MS)
      expect(batchesOf(live)).toEqual([{ dirNames: [], foldersChanged: false, all: true }])
    })

    it('keeps retrying while the root stays missing', () => {
      const fake = fakeWatch([errorWithCode('ENOENT')])
      start(fake, [])
      vi.advanceTimersByTime(ROOT_RETRY_INTERVAL_MS * 3)
      expect(fake.watch).toHaveBeenCalledTimes(4)
    })

    it('closes the watcher and waits when an event with no filename shows the root is gone', () => {
      const fake = fakeWatch([null, null])
      const live = fakeWindow()
      start(fake, [live], () => false)
      fake.watchers[0]?.emit(null)
      expect(fake.watchers[0]?.close).toHaveBeenCalledTimes(1)
      expect(unavailableCount(live)).toBe(0)
      vi.advanceTimersByTime(ROOT_RETRY_INTERVAL_MS)
      expect(fake.watch).toHaveBeenCalledTimes(2)
    })

    it('sends a refresh-everything batch when an event with an empty filename shows the root is gone', () => {
      const fake = fakeWatch([null, null])
      const live = fakeWindow()
      start(fake, [live], () => false)
      fake.watchers[0]?.emit('')
      vi.advanceTimersByTime(LIVE_UPDATE_INTERVAL_MS)
      expect(batchesOf(live)).toEqual([{ dirNames: [], foldersChanged: false, all: true }])
    })

    it('closes the watcher and waits when an event named for the root shows it is gone', () => {
      const fake = fakeWatch([null, null])
      const live = fakeWindow()
      start(fake, [live], () => false)
      fake.watchers[0]?.emit('projects')
      expect(fake.watchers[0]?.close).toHaveBeenCalledTimes(1)
      expect(unavailableCount(live)).toBe(0)
      vi.advanceTimersByTime(ROOT_RETRY_INTERVAL_MS)
      expect(fake.watch).toHaveBeenCalledTimes(2)
    })

    it('delivers events again after the root comes back', () => {
      const fake = fakeWatch([null, null])
      const live = fakeWindow()
      let present = false
      start(fake, [live], () => present)
      fake.watchers[0]?.emit('projects')
      present = true
      vi.advanceTimersByTime(ROOT_RETRY_INTERVAL_MS + LIVE_UPDATE_INTERVAL_MS)
      live.send.mockClear()

      fake.watchers[1]?.emit('-Users-a/one.jsonl')
      vi.advanceTimersByTime(LIVE_UPDATE_INTERVAL_MS)

      expect(batchesOf(live)).toEqual([
        { dirNames: ['-Users-a'], foldersChanged: false, all: false }
      ])
    })

    it('widens to all, never naming the root as a folder, when an event named for the root finds it present', () => {
      const fake = fakeWatch()
      const live = fakeWindow()
      start(fake, [live], () => true)
      fake.watchers[0]?.emit('projects')
      vi.advanceTimersByTime(LIVE_UPDATE_INTERVAL_MS)
      expect(batchesOf(live)).toEqual([{ dirNames: [], foldersChanged: false, all: true }])
      expect(fake.watchers[0]?.close).not.toHaveBeenCalled()
    })

    it('still maps a deeper path that starts with the root’s name to a folder', () => {
      const fake = fakeWatch()
      const live = fakeWindow()
      start(fake, [live])
      fake.watchers[0]?.emit('projects/one.jsonl')
      vi.advanceTimersByTime(LIVE_UPDATE_INTERVAL_MS)
      expect(batchesOf(live)).toEqual([
        { dirNames: ['projects'], foldersChanged: false, all: false }
      ])
    })

    it('stops retrying once closed', () => {
      const fake = fakeWatch([errorWithCode('ENOENT'), null])
      const watcher = start(fake, [])
      watcher.close()
      vi.advanceTimersByTime(ROOT_RETRY_INTERVAL_MS * 2)
      expect(fake.watch).toHaveBeenCalledTimes(1)
    })
  })

  describe('a failure', () => {
    it('becomes unavailable with no retry when watching cannot start', () => {
      const fake = fakeWatch([errorWithCode('EMFILE'), null])
      const live = fakeWindow()
      start(fake, [live])
      vi.advanceTimersByTime(ROOT_RETRY_INTERVAL_MS * 2)
      expect(fake.watch).toHaveBeenCalledTimes(1)
      expect(unavailableCount(live)).toBe(1)
    })

    it('logs the error code and never the root path', () => {
      const fake = fakeWatch([errorWithCode('ENOSPC')])
      start(fake, [])
      expect(warn.mock.calls).toEqual([['Live updates stopped (ENOSPC).']])
    })

    it('closes the watcher and reports once for a later error event', () => {
      const fake = fakeWatch()
      const live = fakeWindow()
      start(fake, [live])
      fake.watchers[0]?.fail(errorWithCode('EPERM'))
      fake.watchers[0]?.fail(errorWithCode('EPERM'))
      expect(fake.watchers[0]?.close).toHaveBeenCalledTimes(1)
      expect(unavailableCount(live)).toBe(1)
      expect(warn).toHaveBeenCalledTimes(1)
    })

    it('does not retry after an error event', () => {
      const fake = fakeWatch()
      start(fake, [])
      fake.watchers[0]?.fail(errorWithCode('EPERM'))
      vi.advanceTimersByTime(ROOT_RETRY_INTERVAL_MS * 2)
      expect(fake.watch).toHaveBeenCalledTimes(1)
    })

    it('drops a pending batch and ignores later events once unavailable', () => {
      const fake = fakeWatch()
      const live = fakeWindow()
      start(fake, [live])
      fake.watchers[0]?.emit('-Users-a/one.jsonl')
      fake.watchers[0]?.fail(errorWithCode('EPERM'))
      fake.watchers[0]?.emit('-Users-a/two.jsonl')
      vi.advanceTimersByTime(LIVE_UPDATE_INTERVAL_MS * 2)
      expect(batchesOf(live)).toEqual([])
    })

    it('skips loading windows in the broadcast', () => {
      const fake = fakeWatch([errorWithCode('EMFILE')])
      const loading = fakeWindow({ loading: true })
      start(fake, [loading])
      expect(loading.send).not.toHaveBeenCalled()
    })
  })

  describe('notifyWindow', () => {
    it('sends nothing to a new window while live updates work', () => {
      const fake = fakeWatch()
      const watcher = start(fake, [])
      const fresh = fakeWindow({ loading: true })
      watcher.notifyWindow(fresh.window)
      fresh.finishLoad()
      expect(fresh.send).not.toHaveBeenCalled()
    })

    it('tells a window created after the failure once its page has loaded', () => {
      const fake = fakeWatch([errorWithCode('EMFILE')])
      const watcher = start(fake, [])
      const fresh = fakeWindow({ loading: true })
      watcher.notifyWindow(fresh.window)
      expect(fresh.send).not.toHaveBeenCalled()
      fresh.finishLoad()
      expect(unavailableCount(fresh)).toBe(1)
    })

    it('tells a window again when its page reloads after the failure', () => {
      const fake = fakeWatch([errorWithCode('EMFILE')])
      const watcher = start(fake, [])
      const fresh = fakeWindow({ loading: true })
      watcher.notifyWindow(fresh.window)
      fresh.finishLoad()
      fresh.finishLoad()
      expect(unavailableCount(fresh)).toBe(2)
    })

    it('tells a window that was loading when the failure happened', () => {
      const fake = fakeWatch()
      const loading = fakeWindow({ loading: true })
      const watcher = start(fake, [loading])
      watcher.notifyWindow(loading.window)
      fake.watchers[0]?.fail(errorWithCode('EPERM'))
      loading.finishLoad()
      expect(unavailableCount(loading)).toBe(1)
    })

    it('sends nothing to a window destroyed before its page loaded', () => {
      const fake = fakeWatch([errorWithCode('EMFILE')])
      const watcher = start(fake, [])
      const fresh = fakeWindow({ loading: true })
      watcher.notifyWindow(fresh.window)
      fresh.destroy()
      fresh.finishLoad()
      expect(fresh.send).not.toHaveBeenCalled()
    })
  })

  describe('close', () => {
    it('closes the watcher', () => {
      const fake = fakeWatch()
      const watcher = start(fake, [])
      watcher.close()
      expect(fake.watchers[0]?.close).toHaveBeenCalledTimes(1)
    })

    it('sends no pending batch', () => {
      const fake = fakeWatch()
      const live = fakeWindow()
      const watcher = start(fake, [live])
      fake.watchers[0]?.emit('-Users-a/one.jsonl')
      watcher.close()
      vi.advanceTimersByTime(LIVE_UPDATE_INTERVAL_MS * 2)
      expect(live.send).not.toHaveBeenCalled()
    })

    it('does nothing when called twice', () => {
      const fake = fakeWatch()
      const watcher = start(fake, [])
      watcher.close()
      watcher.close()
      expect(fake.watchers[0]?.close).toHaveBeenCalledTimes(1)
    })
  })
})
