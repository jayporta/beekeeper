import { idbStorage } from '@renderer/storage/idbStorage'
import { FIRST_RUN_STORAGE_KEY, useFirstRunStore } from './state/useFirstRunStore'

/** Returns the first-run store and its IndexedDB entry to a fresh install, between tests. */
export async function resetFirstRun(): Promise<void> {
  useFirstRunStore.setState({ dismissed: false, isOpen: false })
  await idbStorage.removeItem(FIRST_RUN_STORAGE_KEY)
}
