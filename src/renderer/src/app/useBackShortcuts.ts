import { useEffect, useEffectEvent } from 'react'
import { isBackKeyEvent } from './isBackKeyEvent'
import { isModalDialogOpen } from './isModalDialogOpen'

/** The mouse button number for the back button, which sits beside the thumb on most mice. */
const MOUSE_BACK_BUTTON = 3

/**
 * How soon after one menu Back another counts as the same held accelerator
 * repeating, in milliseconds. The menu sends no repeat flag, and macOS repeats
 * a held accelerator, which would walk the whole history. Alt and the left
 * arrow ignore repeats by their own flag.
 */
const MENU_REPEAT_MS = 300

/**
 * Goes back from the places other than the Back button: the View menu's Back
 * item (Cmd or Ctrl+[), Alt and the left arrow, and the mouse's back button.
 * A shortcut pressed in a control that uses the key itself is ignored (see
 * {@link isBackKeyEvent}), and so is every shortcut while a modal dialog is
 * open, since the page behind it is inert. The mouse's back button is cancelled
 * either way, so the browser does not also move through its own history. A
 * menu request within {@link MENU_REPEAT_MS} of the one before it, accepted or
 * not, is a held key repeating and is ignored.
 *
 * Call it once, where the Back button renders. The listeners are registered
 * once, and always call the `goBack` of the latest render.
 *
 * @param goBack - What to do on each shortcut. It does nothing when there is nowhere to go back to.
 */
export function useBackShortcuts(goBack: () => void): void {
  const onBack = useEffectEvent(goBack)

  useEffect(() => {
    const back = (): void => {
      if (!isModalDialogOpen()) onBack()
    }
    let lastMenuBackAt = Number.NEGATIVE_INFINITY
    const stopMenu = window.beekeeper.onGoBack(() => {
      const now = Date.now()
      const repeating = now - lastMenuBackAt < MENU_REPEAT_MS
      lastMenuBackAt = now
      if (!repeating) back()
    })
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!isBackKeyEvent(event) || isModalDialogOpen()) return
      event.preventDefault()
      onBack()
    }
    // The browser's own history back runs on the release, and a click event follows it. Only the
    // release goes back, and both are cancelled.
    const onMouseUp = (event: MouseEvent): void => {
      if (event.button !== MOUSE_BACK_BUTTON) return
      event.preventDefault()
      back()
    }
    const onAuxClick = (event: MouseEvent): void => {
      if (event.button === MOUSE_BACK_BUTTON) event.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('auxclick', onAuxClick)
    return () => {
      stopMenu()
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('auxclick', onAuxClick)
    }
  }, [])
}
