import { useEffect, useState } from 'react'
import { useFirstRunStore } from './useFirstRunStore'

/**
 * Loads the persisted first-run state and reports when that attempt is over.
 * It turns `true` whether the read succeeded or failed: a failed read leaves
 * the screen not dismissed, so it is shown rather than hidden.
 *
 * @returns `false` until the stored state has been read or the read failed.
 */
export function useFirstRunHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    let active = true
    void Promise.resolve(useFirstRunStore.persist.rehydrate()).then(() => {
      if (active) setHydrated(true)
    })
    return () => {
      active = false
    }
  }, [])

  return hydrated
}
