import { idbStorage } from '@renderer/storage/idbStorage'
import {
  SELECTED_PROJECT_STORAGE_KEY,
  useSelectedProjectStore
} from './state/useSelectedProjectStore'

/** Returns the project selection store and its IndexedDB entry to a fresh install, between tests. */
export async function resetProjects(): Promise<void> {
  useSelectedProjectStore.setState({ selectedDirName: null })
  await idbStorage.removeItem(SELECTED_PROJECT_STORAGE_KEY)
}
