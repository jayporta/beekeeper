import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC_CHANNELS } from '../../../shared/ipc/channels'
import { errorWithCode } from '../../../core/shared/testErrorWithCode'
import { createFakeArchive } from '../../../service/archive/testFakeArchive'
import { countingDeps } from '../../../service/worktrees/testCountingDeps'
import { guardArchive } from '../../archive/guardArchive'
import { createOtelRuntime } from '../../otel/createOtelRuntime'
import { TEST_SESSION_ID } from '../../otel/testOtlpLogs'
import { createIpcDeps } from '../createIpcDeps'
import type { IpcDeps } from '../ipcDeps'
import { registerIpcHandlers, type IpcMainLike } from '../registerIpcHandlers'
import { isTrustedSender, type SenderEvent } from '../senderValidation'
import { TEST_INDEX_URL, TEST_ORIGINS } from '../testSender'
import {
  buildServiceTestTree,
  TEST_PROJECT,
  TEST_SESSION_ID as TREE_SESSION_ID,
  type ServiceTestTree
} from '../../../service/testServiceTree'

type Listener = Parameters<IpcMainLike['handle']>[1]

const trustedEvent: SenderEvent = { senderFrame: { url: TEST_INDEX_URL, parent: null } }

function fakeIpcMain(): { ipcMain: IpcMainLike; listeners: Map<string, Listener> } {
  const listeners = new Map<string, Listener>()
  return {
    listeners,
    ipcMain: {
      handle(channel, listener) {
        if (listeners.has(channel)) throw new Error('duplicate')
        listeners.set(channel, listener)
      }
    }
  }
}

let tree: ServiceTestTree

beforeEach(async () => {
  tree = await buildServiceTestTree()
})

afterEach(async () => {
  vi.restoreAllMocks()
  await tree.cleanup()
})

/** What {@link register} wires in beyond the temp tree's defaults. */
interface RegisterOptions {
  readonly otel?: IpcDeps['otel']
  readonly copyToClipboard?: IpcDeps['copyToClipboard']
  readonly archive?: IpcDeps['archive']
  readonly overrides?: Partial<IpcDeps>
}

function register(options: RegisterOptions = {}): Map<string, Listener> {
  const { otel = null, copyToClipboard = null, archive = null, overrides } = options
  const { ipcMain, listeners } = fakeIpcMain()
  registerIpcHandlers({
    ipcMain,
    isTrusted: (event) => isTrustedSender(event, TEST_ORIGINS),
    deps: { ...createIpcDeps(tree.home), otel, copyToClipboard, archive, ...overrides }
  })
  return listeners
}

describe('registerIpcHandlers', () => {
  it('registers exactly the channels the contract names', () => {
    expect([...register().keys()].sort()).toEqual(Object.values(IPC_CHANNELS).sort())
  })

  it('serves a trusted sender', async () => {
    const listener = register().get(IPC_CHANNELS.listProjects)
    expect(await listener?.(trustedEvent)).toEqual({
      ok: true,
      value: [{ dirName: TEST_PROJECT, label: null, worktreeOf: null, worktreeName: null }]
    })
  })

  it.each([
    ['a traversal name', { projectDirName: '..' }],
    ['a non-object payload', TEST_PROJECT]
  ])('answers invalid-request on the listSessions channel for %s', async (_label, payload) => {
    const listener = register().get(IPC_CHANNELS.listSessions)

    expect(await listener?.(trustedEvent, payload)).toEqual({
      ok: false,
      error: { code: 'invalid-request' }
    })
  })

  it.each([
    ['a traversal project name', { projectDirName: '..', sessionId: TREE_SESSION_ID }],
    [
      'an uppercase session id',
      { projectDirName: TEST_PROJECT, sessionId: TREE_SESSION_ID.toUpperCase() }
    ],
    ['a missing session id', { projectDirName: TEST_PROJECT }],
    ['a session id that is not a uuid', { projectDirName: TEST_PROJECT, sessionId: 'not-a-uuid' }],
    ['a non-object payload', TEST_PROJECT]
  ])(
    'answers invalid-request on the getSession channel for %s without reading the archive',
    async (_label, payload) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const archive = guardArchive(createFakeArchive(errorWithCode('EGETSESSION_NEVER')))
      const listener = register({ archive }).get(IPC_CHANNELS.getSession)

      expect(await listener?.(trustedEvent, payload)).toEqual({
        ok: false,
        error: { code: 'invalid-request' }
      })
      // A read would throw, and the guard would log it instead of failing the request.
      expect(warn).not.toHaveBeenCalled()
    }
  )

  it.each([
    ['a traversal project name', { projectDirName: '..', sessionId: TREE_SESSION_ID }],
    ['a non-object payload', TEST_PROJECT]
  ])(
    'answers invalid-request on the getWorktreeDiffs channel for %s, locating no git and scanning nothing',
    async (_label, payload) => {
      const { deps: counting, counts } = countingDeps(createIpcDeps(tree.home))
      const overrides = { scans: counting.scans, git: counting.git }
      const listener = register({ overrides }).get(IPC_CHANNELS.getWorktreeDiffs)

      expect(await listener?.(trustedEvent, payload)).toEqual({
        ok: false,
        error: { code: 'invalid-request' }
      })
      expect(counts).toEqual({ scans: 0, git: 0 })
    }
  )

  it.each([
    ['no agent id', { projectDirName: TEST_PROJECT, sessionId: TREE_SESSION_ID }],
    [
      'a path as the agent id',
      { projectDirName: TEST_PROJECT, sessionId: TREE_SESSION_ID, agentId: '../a1' }
    ],
    ['a non-object payload', TEST_PROJECT]
  ])(
    'answers invalid-request on the getWorktreePatch channel for %s, locating no git and scanning nothing',
    async (_label, payload) => {
      const { deps: counting, counts } = countingDeps(createIpcDeps(tree.home))
      const overrides = { scans: counting.scans, git: counting.git }
      const listener = register({ overrides }).get(IPC_CHANNELS.getWorktreePatch)

      expect(await listener?.(trustedEvent, payload)).toEqual({
        ok: false,
        error: { code: 'invalid-request' }
      })
      expect(counts).toEqual({ scans: 0, git: 0 })
    }
  )

  it.each([
    ['an unknown window', { projectDirName: TEST_PROJECT, window: '1d' }],
    ['no window', { projectDirName: TEST_PROJECT }],
    ['an extra field', { projectDirName: TEST_PROJECT, window: '7d', path: '/etc' }],
    ['a traversal project name', { projectDirName: '../x', window: '7d' }],
    ['a non-object payload', TEST_PROJECT]
  ])(
    'answers invalid-request on the getProjectTotals channel for %s, reading nothing',
    async (_label, payload) => {
      const reads: string[] = []
      const summaryCache: IpcDeps['summaryCache'] = {
        read: (file) => {
          reads.push(file.path)
          return Promise.reject(new Error('never read'))
        }
      }
      const listener = register({ overrides: { summaryCache } }).get(IPC_CHANNELS.getProjectTotals)

      expect(await listener?.(trustedEvent, payload)).toEqual({
        ok: false,
        error: { code: 'invalid-request' }
      })
      expect(reads).toEqual([])
    }
  )

  it.each([
    ['an unknown window', { projectDirName: TEST_PROJECT, window: '1d' }],
    ['no window', { projectDirName: TEST_PROJECT }],
    ['an extra field', { projectDirName: TEST_PROJECT, window: '7d', path: '/etc' }],
    ['a traversal project name', { projectDirName: '../x', window: '7d' }],
    ['a non-object payload', TEST_PROJECT]
  ])(
    'answers invalid-request on the getProjectDailyUsage channel for %s, scanning nothing',
    async (_label, payload) => {
      let scans = 0
      const real = createIpcDeps(tree.home).dailyUsageScans
      const dailyUsageScans: IpcDeps['dailyUsageScans'] = {
        run: (key, task) => {
          scans += 1
          return real.run(key, task)
        }
      }
      const listener = register({ overrides: { dailyUsageScans } }).get(
        IPC_CHANNELS.getProjectDailyUsage
      )

      expect(await listener?.(trustedEvent, payload)).toEqual({
        ok: false,
        error: { code: 'invalid-request' }
      })
      expect(scans).toBe(0)
    }
  )

  it('serves the telemetry receiver channels from the runtime it is given', async () => {
    const runtime = createOtelRuntime({
      settingsPath: join(tree.home, 'otel.json'),
      pickPort: () => 0
    })
    const listeners = register({ otel: runtime })
    const on = await listeners.get(IPC_CHANNELS.setOtelReceiverEnabled)?.(trustedEvent, {
      enabled: true
    })

    try {
      expect(on).toMatchObject({ ok: true, value: { enabled: true, status: 'listening' } })
      expect(await listeners.get(IPC_CHANNELS.getOtelReceiver)?.(trustedEvent)).toEqual(on)
      expect(
        await listeners.get(IPC_CHANNELS.getReportedCost)?.(trustedEvent, {
          sessionId: TEST_SESSION_ID
        })
      ).toEqual({ ok: true, value: null })
    } finally {
      await runtime.receiver.stop()
    }
  })

  it('copies text for a trusted sender and refuses an untrusted one', async () => {
    const copied: string[] = []
    const listener = register({ copyToClipboard: (text) => copied.push(text) }).get(
      IPC_CHANNELS.copyText
    )

    const trusted = await listener?.(trustedEvent, { text: 'a=b' })
    const foreign = await listener?.({ senderFrame: null }, { text: 'c=d' })

    expect([trusted, foreign, copied]).toEqual([
      { ok: true, value: null },
      { ok: false, error: { code: 'untrusted-sender' } },
      ['a=b']
    ])
  })

  it('serves the telemetry receiver channels as off when no runtime is wired', async () => {
    const listeners = register()

    expect(await listeners.get(IPC_CHANNELS.getOtelReceiver)?.(trustedEvent)).toMatchObject({
      ok: true,
      value: { enabled: false, status: 'off' }
    })
  })

  it.each([
    ['a subframe', { senderFrame: { url: trustedEvent.senderFrame?.url ?? '', parent: {} } }],
    ['a foreign page', { senderFrame: { url: 'https://example.com/', parent: null } }],
    ['a null frame', { senderFrame: null }]
  ])('refuses %s on every channel', async (_label, event) => {
    for (const listener of register().values()) {
      expect(await listener(event, {})).toEqual({
        ok: false,
        error: { code: 'untrusted-sender' }
      })
    }
  })
})
