import { afterEach, describe, expect, it } from 'vitest'
import { idbStorage } from '@renderer/storage/idbStorage'
import { resetPersistedState } from '@renderer/testRenderApp'
import { DEFAULT_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH, MIN_SIDEBAR_WIDTH } from '../sidebarWidth'
import { SIDEBAR_WIDTH_STORAGE_KEY, useSidebarWidthStore } from '../state/useSidebarWidthStore'

afterEach(async () => {
  await resetPersistedState()
})

/** Stores a raw value under the store's key and loads the store from it. */
async function hydrateFrom(state: unknown): Promise<void> {
  await idbStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, JSON.stringify({ state, version: 0 }))
  await useSidebarWidthStore.persist.rehydrate()
}

describe('useSidebarWidthStore', () => {
  it('starts at the default width', () => {
    expect(useSidebarWidthStore.getState().width).toBe(DEFAULT_SIDEBAR_WIDTH)
  })

  it('loads a stored width', async () => {
    await hydrateFrom({ width: 320 })

    expect(useSidebarWidthStore.getState().width).toBe(320)
  })

  it('writes a changed width to storage', async () => {
    useSidebarWidthStore.getState().setWidth(300)

    await expect
      .poll(async () => idbStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY))
      .toContain('"width":300')
  })

  it('clamps a stored width above the maximum', async () => {
    await hydrateFrom({ width: 9999 })

    expect(useSidebarWidthStore.getState().width).toBe(MAX_SIDEBAR_WIDTH)
  })

  it('clamps a stored width below the minimum', async () => {
    await hydrateFrom({ width: 5 })

    expect(useSidebarWidthStore.getState().width).toBe(MIN_SIDEBAR_WIDTH)
  })

  it('keeps the default for a stored value that is not a number', async () => {
    await hydrateFrom({ width: 'wide' })

    expect(useSidebarWidthStore.getState().width).toBe(DEFAULT_SIDEBAR_WIDTH)
  })
})
