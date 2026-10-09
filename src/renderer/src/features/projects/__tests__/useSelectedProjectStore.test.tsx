import { waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { idbStorage } from '@renderer/storage/idbStorage'
import { resetPersistedState } from '@renderer/testRenderApp'
import {
  SELECTED_PROJECT_STORAGE_KEY,
  useSelectedProjectStore
} from '../state/useSelectedProjectStore'

const ALPHA = '-Users-a-alpha'
const BETA = '-Users-a-beta'

afterEach(async () => {
  vi.restoreAllMocks()
  await resetPersistedState()
})

/** Lets a store change reach the storage write it starts. */
const afterWrite = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 20))

/** What the store has written to IndexedDB, parsed, or `null` when nothing is there. */
async function storedState(): Promise<unknown> {
  const raw = await idbStorage.getItem(SELECTED_PROJECT_STORAGE_KEY)
  return raw === null ? null : (JSON.parse(raw) as { state: unknown }).state
}

describe('forgetGoneFolder', () => {
  it('clears the selection and records the folder that went missing', () => {
    useSelectedProjectStore.setState({ selectedDirName: ALPHA })

    useSelectedProjectStore.getState().forgetGoneFolder(ALPHA)

    expect(useSelectedProjectStore.getState()).toMatchObject({
      selectedDirName: null,
      goneDirName: ALPHA
    })
  })

  it('does not write the missing folder to storage', async () => {
    useSelectedProjectStore.getState().forgetGoneFolder(ALPHA)

    await waitFor(async () => {
      expect(await storedState()).toEqual({ selectedDirName: null })
    })
  })
})

describe('select', () => {
  it('chooses the folder and clears a recorded missing folder', () => {
    useSelectedProjectStore.setState({ selectedDirName: null, goneDirName: ALPHA })

    useSelectedProjectStore.getState().select(BETA)

    expect(useSelectedProjectStore.getState()).toMatchObject({
      selectedDirName: BETA,
      goneDirName: null
    })
  })
})

describe('clearGoneFolder', () => {
  it('writes nothing to storage when no folder is recorded as gone', async () => {
    useSelectedProjectStore.setState({ selectedDirName: BETA, goneDirName: null })
    await afterWrite()
    const write = vi.spyOn(idbStorage, 'setItem')

    useSelectedProjectStore.getState().clearGoneFolder()
    await afterWrite()

    expect(write).not.toHaveBeenCalled()
  })

  it('forgets the missing folder and keeps the selection', () => {
    useSelectedProjectStore.setState({ selectedDirName: BETA, goneDirName: ALPHA })

    useSelectedProjectStore.getState().clearGoneFolder()

    expect(useSelectedProjectStore.getState()).toMatchObject({
      selectedDirName: BETA,
      goneDirName: null
    })
  })
})

describe('restoreFolder', () => {
  it('brings back the selection of a folder that was recorded as gone', () => {
    useSelectedProjectStore.setState({ selectedDirName: null, goneDirName: ALPHA })

    useSelectedProjectStore.getState().restoreFolder(ALPHA)

    expect(useSelectedProjectStore.getState()).toMatchObject({
      selectedDirName: ALPHA,
      goneDirName: null
    })
  })

  it('changes nothing, and writes nothing, for a folder that was not recorded as gone', async () => {
    useSelectedProjectStore.setState({ selectedDirName: BETA, goneDirName: ALPHA })
    await afterWrite()
    const write = vi.spyOn(idbStorage, 'setItem')

    useSelectedProjectStore.getState().restoreFolder(BETA)
    await afterWrite()

    expect(useSelectedProjectStore.getState()).toMatchObject({
      selectedDirName: BETA,
      goneDirName: ALPHA
    })
    expect(write).not.toHaveBeenCalled()
  })
})
