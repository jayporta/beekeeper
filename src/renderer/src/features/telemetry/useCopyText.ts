import { useCallback, useEffect, useState } from 'react'
import { LIVE_COPY_CLEAR_MS } from '@renderer/components/liveCopyClearMs'
import { unwrapIpcResult } from '@renderer/ipc/unwrapIpcResult'

/** How the last copy went. `idle` before one, and again after the message has been up for a while. */
export type CopyState = 'idle' | 'copied' | 'failed'

/**
 * Copies text to the system clipboard through the main process, since the
 * page's own clipboard access is denied, and remembers how it went. A failed
 * call is reported as `failed` for the caller to show, not thrown. The outcome
 * clears itself after {@link LIVE_COPY_CLEAR_MS}.
 *
 * @returns How the last copy went, and the function that copies.
 */
export function useCopyText(): {
  state: CopyState
  copy: (text: string) => Promise<void>
} {
  const [state, setState] = useState<CopyState>('idle')

  useEffect(() => {
    if (state === 'idle') return
    const timer = setTimeout(() => {
      setState('idle')
    }, LIVE_COPY_CLEAR_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [state])

  const copy = useCallback(async (text: string): Promise<void> => {
    try {
      unwrapIpcResult(await window.beekeeper.copyText(text))
      setState('copied')
    } catch {
      setState('failed')
    }
  }, [])

  return { state, copy }
}
