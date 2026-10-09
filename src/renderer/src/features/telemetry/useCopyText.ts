import { useCallback, useEffect, useState } from 'react'
import { LIVE_COPY_CLEAR_MS } from '@renderer/components/liveCopyClearMs'
import { unwrapIpcResult } from '@renderer/ipc/unwrapIpcResult'

/** How the last copy went. `idle` before one, while one is in flight, and after a success has been showing for a while. */
export type CopyState = 'idle' | 'copied' | 'failed'

/**
 * Copies text to the system clipboard through the main process, since the
 * page's own clipboard access is denied, and remembers how it went. A failed
 * call is reported as `failed` for the caller to show, not thrown.
 *
 * @remarks
 * Each call first resets the outcome to `idle`, so a status region that shows
 * it is emptied and then filled again, and a repeated outcome is announced
 * every time. A `copied` outcome clears itself after {@link LIVE_COPY_CLEAR_MS}.
 * A `failed` one stays until the next call, since it tells the person what to
 * do next.
 *
 * @returns How the last copy went, and the function that copies.
 */
export function useCopyText(): {
  state: CopyState
  copy: (text: string) => Promise<void>
} {
  const [state, setState] = useState<CopyState>('idle')

  useEffect(() => {
    if (state !== 'copied') return
    const timer = setTimeout(() => {
      setState('idle')
    }, LIVE_COPY_CLEAR_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [state])

  const copy = useCallback(async (text: string): Promise<void> => {
    setState('idle')
    try {
      unwrapIpcResult(await window.beekeeper.copyText(text))
      setState('copied')
    } catch {
      setState('failed')
    }
  }, [])

  return { state, copy }
}
