import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FilesChangedDto } from '../../../shared/ipc/filesChangedDto'
import { MAX_CHANGED_FOLDERS } from '../../../shared/ipc/filesChangedDto'
import { createChangeBatcher, LIVE_UPDATE_INTERVAL_MS, type ChangeBatcher } from '../changeBatcher'
import type { FolderChange } from '../changedFolder'

const file = (dirName: string): FolderChange => ({ kind: 'folder', dirName, isFolderItself: false })
const folderItself = (dirName: string): FolderChange => ({
  kind: 'folder',
  dirName,
  isFolderItself: true
})
const UNKNOWN: FolderChange = { kind: 'unknown' }
const IGNORED: FolderChange = { kind: 'ignored' }

function setup(): { sent: FilesChangedDto[]; batcher: ChangeBatcher } {
  const sent: FilesChangedDto[] = []
  const batcher = createChangeBatcher({
    send: (change) => sent.push(change),
    setTimer: (run, ms) => setTimeout(run, ms),
    clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>)
  })
  return { sent, batcher }
}

describe('createChangeBatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('sends nothing before the interval has passed', () => {
    const { sent, batcher } = setup()
    batcher.add(file('a'))
    vi.advanceTimersByTime(LIVE_UPDATE_INTERVAL_MS - 1)
    expect(sent).toEqual([])
  })

  it('sends one batch once the interval from the first change has passed', () => {
    const { sent, batcher } = setup()
    batcher.add(file('a'))
    vi.advanceTimersByTime(500)
    batcher.add(file('b'))
    vi.advanceTimersByTime(LIVE_UPDATE_INTERVAL_MS - 500)
    expect(sent).toEqual([{ dirNames: ['a', 'b'], foldersChanged: false, all: false }])
  })

  it('starts a new batch for a change after a flush', () => {
    const { sent, batcher } = setup()
    batcher.add(file('a'))
    vi.advanceTimersByTime(LIVE_UPDATE_INTERVAL_MS)
    batcher.add(file('b'))
    vi.advanceTimersByTime(LIVE_UPDATE_INTERVAL_MS)
    expect(sent).toEqual([
      { dirNames: ['a'], foldersChanged: false, all: false },
      { dirNames: ['b'], foldersChanged: false, all: false }
    ])
  })

  it('sends a single batch with sorted unique names for a burst of 1,000 events', () => {
    const { sent, batcher } = setup()
    for (let i = 0; i < 1000; i++) batcher.add(file(['c', 'a', 'b'][i % 3] ?? 'a'))
    vi.advanceTimersByTime(LIVE_UPDATE_INTERVAL_MS)
    expect(sent).toEqual([{ dirNames: ['a', 'b', 'c'], foldersChanged: false, all: false }])
  })

  it('keeps a batch of exactly the cap as folder names', () => {
    const { sent, batcher } = setup()
    for (let i = 0; i < MAX_CHANGED_FOLDERS; i++) batcher.add(file(`f-${i}`))
    vi.advanceTimersByTime(LIVE_UPDATE_INTERVAL_MS)
    expect(sent[0]?.all).toBe(false)
    expect(sent[0]?.dirNames).toHaveLength(MAX_CHANGED_FOLDERS)
  })

  it('sends all with no names for a batch over the cap', () => {
    const { sent, batcher } = setup()
    for (let i = 0; i <= MAX_CHANGED_FOLDERS; i++) batcher.add(file(`f-${i}`))
    vi.advanceTimersByTime(LIVE_UPDATE_INTERVAL_MS)
    expect(sent).toEqual([{ dirNames: [], foldersChanged: false, all: true }])
  })

  it('sends all with no names when a change is unknown', () => {
    const { sent, batcher } = setup()
    batcher.add(file('a'))
    batcher.add(UNKNOWN)
    batcher.add(file('b'))
    vi.advanceTimersByTime(LIVE_UPDATE_INTERVAL_MS)
    expect(sent).toEqual([{ dirNames: [], foldersChanged: false, all: true }])
  })

  it('sends nothing for an ignored change', () => {
    const { sent, batcher } = setup()
    batcher.add(IGNORED)
    vi.advanceTimersByTime(LIVE_UPDATE_INTERVAL_MS * 2)
    expect(sent).toEqual([])
  })

  it('leaves an ignored change out of a batch', () => {
    const { sent, batcher } = setup()
    batcher.add(IGNORED)
    batcher.add(file('a'))
    batcher.add(IGNORED)
    vi.advanceTimersByTime(LIVE_UPDATE_INTERVAL_MS)
    expect(sent).toEqual([{ dirNames: ['a'], foldersChanged: false, all: false }])
  })

  it('does not start the interval for an ignored change', () => {
    const { sent, batcher } = setup()
    batcher.add(IGNORED)
    vi.advanceTimersByTime(LIVE_UPDATE_INTERVAL_MS - 1)
    batcher.add(file('a'))
    vi.advanceTimersByTime(1)
    expect(sent).toEqual([])
  })

  it('sets foldersChanged when a folder itself changed', () => {
    const { sent, batcher } = setup()
    batcher.add(folderItself('a'))
    batcher.add(file('b'))
    vi.advanceTimersByTime(LIVE_UPDATE_INTERVAL_MS)
    expect(sent).toEqual([{ dirNames: ['a', 'b'], foldersChanged: true, all: false }])
  })

  it('keeps foldersChanged on an all batch', () => {
    const { sent, batcher } = setup()
    batcher.add(folderItself('a'))
    batcher.add(UNKNOWN)
    vi.advanceTimersByTime(LIVE_UPDATE_INTERVAL_MS)
    expect(sent).toEqual([{ dirNames: [], foldersChanged: true, all: true }])
  })

  it('does not carry state from one batch into the next', () => {
    const { sent, batcher } = setup()
    batcher.add(UNKNOWN)
    vi.advanceTimersByTime(LIVE_UPDATE_INTERVAL_MS)
    batcher.add(file('a'))
    vi.advanceTimersByTime(LIVE_UPDATE_INTERVAL_MS)
    expect(sent[1]).toEqual({ dirNames: ['a'], foldersChanged: false, all: false })
  })

  it('sends nothing after dispose', () => {
    const { sent, batcher } = setup()
    batcher.add(file('a'))
    batcher.dispose()
    vi.advanceTimersByTime(LIVE_UPDATE_INTERVAL_MS * 2)
    expect(sent).toEqual([])
  })

  it('starts a fresh batch after dispose', () => {
    const { sent, batcher } = setup()
    batcher.add(file('a'))
    batcher.dispose()
    batcher.add(file('b'))
    vi.advanceTimersByTime(LIVE_UPDATE_INTERVAL_MS)
    expect(sent).toEqual([{ dirNames: ['b'], foldersChanged: false, all: false }])
  })
})
