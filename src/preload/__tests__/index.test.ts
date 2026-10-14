import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BeekeeperApi } from '../../shared/ipc/beekeeperApi'
import { IPC_CHANNELS, IPC_EVENTS } from '../../shared/ipc/channels'

const invoke = vi.fn<(channel: string, payload?: unknown) => Promise<unknown>>()
const exposed = vi.hoisted(() => ({
  api: undefined as BeekeeperApi | undefined,
  /** The listeners the preload registered with `ipcRenderer.on`, by channel. */
  listeners: new Map<string, Set<(...args: unknown[]) => void>>()
}))

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: (_name: string, api: BeekeeperApi) => {
      exposed.api = api
    }
  },
  ipcRenderer: {
    on: (channel: string, listener: (...args: unknown[]) => void) => {
      const set = exposed.listeners.get(channel) ?? new Set()
      set.add(listener)
      exposed.listeners.set(channel, set)
    },
    removeListener: (channel: string, listener: (...args: unknown[]) => void) => {
      exposed.listeners.get(channel)?.delete(listener)
    },
    invoke: (channel: string, payload?: unknown) => invoke(channel, payload)
  }
}))

/** Delivers an event from the main process to every listener registered for `channel`. */
function emit(channel: string, ...args: unknown[]): void {
  for (const listener of [...(exposed.listeners.get(channel) ?? [])]) listener({}, ...args)
}

async function loadApi(): Promise<BeekeeperApi> {
  vi.resetModules()
  await import('../index')
  if (exposed.api === undefined) throw new Error('the preload exposed no API')
  return exposed.api
}

beforeEach(() => {
  exposed.listeners.clear()
  invoke.mockReset()
  invoke.mockResolvedValue({ ok: true, value: null })
})

describe('preload API', () => {
  it('has a wrapper for every request channel in the contract', async () => {
    const api = await loadApi()

    await Promise.all([
      api.listProjects(),
      api.listSessions('p'),
      api.getSession('p', 's'),
      api.getWorktreeDiffs('p', 's'),
      api.getProjectTotals('p', '7d'),
      api.getProjectDailyUsage('p', '7d'),
      api.getWorktreePatch('p', 's', 'a'),
      api.getOtelReceiver(),
      api.setOtelReceiverEnabled(true),
      api.getReportedCost('s'),
      api.copyText('t')
    ])

    expect(invoke.mock.calls.map(([channel]) => channel).sort()).toEqual(
      Object.values(IPC_CHANNELS).sort()
    )
  })

  it('sends the enabled flag to setOtelReceiverEnabled', async () => {
    const api = await loadApi()

    await api.setOtelReceiverEnabled(false)

    expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.setOtelReceiverEnabled, { enabled: false })
  })

  it('sends the session id to getReportedCost', async () => {
    const api = await loadApi()

    await api.getReportedCost('abc')

    expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.getReportedCost, { sessionId: 'abc' })
  })

  it('sends the text to copyText', async () => {
    const api = await loadApi()

    await api.copyText('KEY=value')

    expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.copyText, { text: 'KEY=value' })
  })

  it('sends no payload to getOtelReceiver', async () => {
    const api = await loadApi()

    await api.getOtelReceiver()

    expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.getOtelReceiver, undefined)
  })

  describe('onGoBack', () => {
    it('calls the listener with no arguments each time the main process asks for Back', async () => {
      const api = await loadApi()
      const listener = vi.fn()
      api.onGoBack(listener)

      emit(IPC_EVENTS.goBack)
      emit(IPC_EVENTS.goBack)

      expect(listener.mock.calls).toEqual([[], []])
    })

    it('does not pass the event object to the listener', async () => {
      const api = await loadApi()
      const listener = vi.fn()
      api.onGoBack(listener)

      emit(IPC_EVENTS.goBack, 'payload')

      expect(listener).toHaveBeenCalledWith()
    })

    it('stops calling a listener once it unsubscribes, and no other', async () => {
      const api = await loadApi()
      const removed = vi.fn()
      const kept = vi.fn()
      const unsubscribe = api.onGoBack(removed)
      api.onGoBack(kept)

      unsubscribe()
      emit(IPC_EVENTS.goBack)

      expect(removed).not.toHaveBeenCalled()
      expect(kept).toHaveBeenCalledOnce()
    })

    it('drops a request that arrives while nobody is subscribed, instead of replaying it', async () => {
      const api = await loadApi()
      emit(IPC_EVENTS.goBack)
      const listener = vi.fn()

      api.onGoBack(listener)

      expect(listener).not.toHaveBeenCalled()
    })

    it('drops a request that arrives after the last listener unsubscribed', async () => {
      const api = await loadApi()
      api.onGoBack(vi.fn())()
      emit(IPC_EVENTS.goBack)
      const late = vi.fn()

      api.onGoBack(late)

      expect(late).not.toHaveBeenCalled()
    })
  })
})
