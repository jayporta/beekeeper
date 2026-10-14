import { useEffect, useEffectEvent } from 'react'
import { isBackKeyEvent } from './isBackKeyEvent'

/** The mouse button number for the back button, which sits beside the thumb on most mice. */
const MOUSE_BACK_BUTTON = 3

/**
 * Goes back from the places other than the Back button: the View menu's Back
 * item (Cmd or Ctrl+[), Alt and the left arrow, and the mouse's back button.
 * A shortcut pressed in a control that uses the key itself is ignored (see
 * {@link isBackKeyEvent}). The mouse's back button is cancelled, so the browser
 * does not also move through its own history.
 *
 * Call it once, where the main area renders. The listeners are registered
 * once, and always call the `goBack` of the latest render.
 *
 * @param goBack - What to do on each shortcut. It does nothing when there is nowhere to go back to.
 */
export function useBackShortcuts(goBack: () => void): void {
  const onBack = useEffectEvent(goBack)

  useEffect(() => {
    const stopMenu = window.beekeeper.onGoBack(() => {
      onBack()
    })
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!isBackKeyEvent(event)) return
      event.preventDefault()
      onBack()
    }
    // The browser's own history back runs on the release, and a click event follows it. Only the
    // release goes back, and both are cancelled.
    const onMouseUp = (event: MouseEvent): void => {
      if (event.button !== MOUSE_BACK_BUTTON) return
      event.preventDefault()
      onBack()
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
