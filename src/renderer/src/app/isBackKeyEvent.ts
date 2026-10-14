/**
 * The elements that use the left arrow themselves: text fields move the caret
 * (Alt moves it by word on macOS), a select and a radio group step through
 * their options, and a focusable `hr` is the sidebar's resize handle, a window
 * splitter that steps with the arrow keys.
 */
const ARROW_KEY_TARGETS =
  'input, textarea, select, hr, [contenteditable]:not([contenteditable="false"])'

/**
 * Whether a key event is the Back shortcut: Alt and the left arrow alone, not
 * repeating, that nothing has handled yet, and not pressed in a control that
 * uses the arrow keys for itself. Holding the key down would otherwise walk
 * the whole history.
 *
 * @param event - The keydown event.
 * @returns `true` when the event asks to go back.
 */
export function isBackKeyEvent(event: KeyboardEvent): boolean {
  if (event.key !== 'ArrowLeft' || !event.altKey) return false
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.repeat) return false
  if (event.defaultPrevented) return false
  const { target } = event
  return !(target instanceof Element && target.closest(ARROW_KEY_TARGETS) !== null)
}
