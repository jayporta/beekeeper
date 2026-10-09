import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BeekeeperApi } from '../../shared/ipc/beekeeperApi'
import { IPC_CHANNELS } from '../../shared/ipc/channels'

const invoke = vi.fn<(channel: string, payload?: unknown) => Promise<unknown>>()
const exposed = vi.hoisted(() => ({ api: undefined as BeekeeperApi | undefined }))

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: (_name: string, api: BeekeeperApi) => {
      exposed.api = api
    }
  },
  ipcRenderer: {
    on: vi.fn(),
    invoke: (channel: string, payload?: unknown) => invoke(channel, payload)
  }
}))

async function loadApi(): Promise<BeekeeperApi> {
  vi.resetModules()
  await import('../index')
  if (exposed.api === undefined) throw new Error('the preload exposed no API')
  return exposed.api
}

beforeEach(() => {
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
      api.getReportedCost('s')
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

  it('sends no payload to getOtelReceiver', async () => {
    const api = await loadApi()

    await api.getOtelReceiver()

    expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.getOtelReceiver, undefined)
  })
})
