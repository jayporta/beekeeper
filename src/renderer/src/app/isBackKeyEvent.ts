/**
 * The widgets that use the left arrow themselves: text fields move the caret
 * (Alt moves it by word on macOS), a select and a radio group step through
 * their options, and the custom widgets of the ARIA patterns that move with the
 * arrow keys have the roles below. The match includes an item inside one, such
 * as an option in a listbox. The sidebar's resize handle is not here: it
 * ignores Alt, so Alt and the left arrow go back from it.
 */
const ARROW_KEY_TARGETS = [
  'input',
  'textarea',
  'select',
  '[contenteditable]:not([contenteditable="false"])',
  ...[
    'slider',
    'spinbutton',
    'listbox',
    'tablist',
    'grid',
    'tree',
    'treegrid',
    'menu',
    'menubar',
    'radiogroup',
    'combobox',
    'textbox',
    'searchbox'
  ].map((role) => `[role="${role}"]`)
].join(', ')

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
