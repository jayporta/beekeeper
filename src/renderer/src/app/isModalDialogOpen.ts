/**
 * Whether a dialog is open. Every dialog in the app is modal (see
 * `ModalDialog`), which makes the page behind it inert, so a shortcut must not
 * navigate that page or tear down the dialog.
 *
 * @returns `true` when a `<dialog>` element is open.
 */
export function isModalDialogOpen(): boolean {
  return document.querySelector('dialog[open]') !== null
}
