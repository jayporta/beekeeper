import { useSyncExternalStore } from 'react'
import { localDayKey } from './localDayKey'

function getSnapshot(): string {
  return localDayKey(Date.now())
}

/**
 * Calls `onChange` when the local day may have changed: at the next local
 * midnight, and when the window gains focus, which catches a machine that
 * slept through midnight with its timer unfired.
 */
function subscribe(onChange: () => void): () => void {
  let timer: ReturnType<typeof setTimeout>

  function scheduleMidnight(): void {
    const now = new Date()
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    timer = setTimeout(() => {
      onChange()
      scheduleMidnight()
    }, midnight.getTime() - now.getTime())
  }

  scheduleMidnight()
  window.addEventListener('focus', onChange)
  return () => {
    clearTimeout(timer)
    window.removeEventListener('focus', onChange)
  }
}

/**
 * The local calendar day, `YYYY-MM-DD`, kept current: it changes when local
 * midnight passes and when the window gains focus.
 *
 * @returns Today's day key.
 */
export function useTodayKey(): string {
  return useSyncExternalStore(subscribe, getSnapshot)
}
