import { useCallback, useEffect, useState } from 'react'

/**
 * Tracks whether the About dialog is open. The menu's About item opens it, and
 * asking again while it is open changes nothing.
 *
 * @returns Whether the dialog is open, and a function that closes it.
 */
export function useAboutRequested(): { open: boolean; close: () => void } {
  const [open, setOpen] = useState(false)

  useEffect(
    () =>
      window.beekeeper.onOpenAbout(() => {
        setOpen(true)
      }),
    []
  )

  const close = useCallback(() => {
    setOpen(false)
  }, [])

  return { open, close }
}
