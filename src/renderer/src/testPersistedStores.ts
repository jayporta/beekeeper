import type { StoreApi } from 'zustand'
import { useFirstRunStore } from '@renderer/features/firstRun/state/useFirstRunStore'
import { useSelectedProjectStore } from '@renderer/features/projects/state/useSelectedProjectStore'
import { idbStorage } from '@renderer/storage/idbStorage'

/** What a test needs from a persisted store: to load it, to wait for the load, and to wipe it. */
export interface PersistedStoreHandle {
  /** The store's `persist` API, to load it from storage and to see when the load is over. */
  readonly persist: {
    /** Loads the store from storage. */
    rehydrate: () => Promise<void> | void
    /** Whether the latest load from storage has finished. */
    hasHydrated: () => boolean
    /** Calls `listener` once the load in progress finishes, and returns a function that stops listening. */
    onFinishHydration: (listener: () => void) => () => void
  }
  /** Returns the store and its IndexedDB entry to a fresh install. */
  reset: () => Promise<void>
}

/** The `persist` API of a store, as far as {@link persistedStore} reads it. */
interface PersistApi {
  rehydrate: () => Promise<void> | void
  hasHydrated: () => boolean
  onFinishHydration: (listener: () => void) => () => void
  getOptions: () => { readonly name?: string }
}

/** Wraps a persisted store as a {@link PersistedStoreHandle}. */
function persistedStore<S>(
  store: StoreApi<S> & { readonly persist: PersistApi }
): PersistedStoreHandle {
  return {
    persist: store.persist,
    reset: async () => {
      store.setState(store.getInitialState())
      const { name } = store.persist.getOptions()
      if (name === undefined) throw new Error('A persisted store needs a storage name')
      await idbStorage.removeItem(name)
    }
  }
}

/**
 * Every persisted store the app waits on before it shows anything. A new
 * persisted store goes here, so hydrating and resetting in tests cover it.
 */
export const PERSISTED_STORES: readonly PersistedStoreHandle[] = [
  persistedStore(useFirstRunStore),
  persistedStore(useSelectedProjectStore)
]
