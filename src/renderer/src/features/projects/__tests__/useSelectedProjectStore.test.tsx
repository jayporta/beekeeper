import { waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { idbStorage } from '@renderer/storage/idbStorage'
import { resetProjects } from '../testProjectsReset'
import {
  SELECTED_PROJECT_STORAGE_KEY,
  useSelectedProjectStore
} from '../state/useSelectedProjectStore'

const ALPHA = '-Users-a-alpha'
const BETA = '-Users-a-beta'

afterEach(resetProjects)

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
  it('forgets the missing folder and keeps the selection', () => {
    useSelectedProjectStore.setState({ selectedDirName: BETA, goneDirName: ALPHA })

    useSelectedProjectStore.getState().clearGoneFolder()

    expect(useSelectedProjectStore.getState()).toMatchObject({
      selectedDirName: BETA,
      goneDirName: null
    })
  })
})
