import { useEffect, useState } from 'react'

/** The part of a Zustand store's `persist` API this hook needs. */
interface Rehydratable {
  /** Reloads the store from storage. Resolves once the read succeeded or failed. */
  rehydrate: () => Promise<void> | void
}

/**
 * Loads a persisted Zustand store from storage and reports when that attempt
 * is over. It turns `true` whether the read succeeded or failed, because a
 * failed read leaves the store at its defaults, which the UI then shows.
 * Pairs with `skipHydration: true` on the store.
 *
 * @param persist - The store's `persist` API, such as `useMyStore.persist`.
 * @returns `false` until the stored state has been read or the read failed.
 */
export function usePersistHydrated(persist: Rehydratable): boolean {
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    let active = true
    void Promise.resolve(persist.rehydrate()).then(() => {
      if (active) setHydrated(true)
    })
    return () => {
      active = false
    }
  }, [persist])

  return hydrated
}
