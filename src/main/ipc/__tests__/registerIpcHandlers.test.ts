import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { IPC_CHANNELS } from '../../../shared/ipc/channels'
import { createIpcDeps } from '../createIpcDeps'
import { registerIpcHandlers, type IpcMainLike } from '../registerIpcHandlers'
import { isTrustedSender, type SenderEvent } from '../senderValidation'
import { TEST_INDEX_URL, TEST_ORIGINS } from '../testSender'
import { buildIpcTestTree, TEST_PROJECT, type IpcTestTree } from '../testIpcTree'

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

let tree: IpcTestTree

beforeEach(async () => {
  tree = await buildIpcTestTree()
})

afterEach(async () => {
  await tree.cleanup()
})

function register(): Map<string, Listener> {
  const { ipcMain, listeners } = fakeIpcMain()
  registerIpcHandlers({
    ipcMain,
    isTrusted: (event) => isTrustedSender(event, TEST_ORIGINS),
    deps: createIpcDeps(tree.home)
  })
  return listeners
}

describe('registerIpcHandlers', () => {
  it('registers exactly the four channels', () => {
    expect([...register().keys()].sort()).toEqual(Object.values(IPC_CHANNELS).sort())
  })

  it('serves a trusted sender', async () => {
    const listener = register().get(IPC_CHANNELS.listProjects)
    expect(await listener?.(trustedEvent)).toEqual({
      ok: true,
      value: [{ dirName: TEST_PROJECT }]
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
