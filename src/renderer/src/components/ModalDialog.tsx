import { useEffect, useRef } from 'react'
import styles from './ModalDialog.module.css'

/** Props for {@link ModalDialog}. */
interface ModalDialogProps {
  /** Whether the dialog is open. */
  readonly open: boolean
  /** Asks to close it: called for Escape and when the dialog closes itself. The parent sets `open` to `false`. */
  readonly onClose: () => void
  /** The id of the heading inside that names the dialog. */
  readonly labelledBy: string
  /** A class that sizes the dialog by setting `--dialog-width`. The default width suits wide content. */
  readonly className?: string
  /** What the dialog holds. It is rendered only while open. */
  readonly children: React.ReactNode
}

/**
 * A modal dialog on the platform's own `<dialog>`: opened with `showModal()`,
 * so the rest of the page is inert and focus stays inside, named by its
 * heading, and closed by Escape or by the parent. When it closes, focus goes
 * back to what had it when the dialog opened.
 *
 * @example
 * <ModalDialog open={open} onClose={() => setOpen(false)} labelledBy="diff-heading">
 *   <h2 id="diff-heading">Diff</h2>
 * </ModalDialog>
 */
export function ModalDialog({
  open,
  onClose,
  labelledBy,
  className,
  children
}: ModalDialogProps): React.JSX.Element {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (dialog === null || !open) return
    const opener = document.activeElement
    dialog.showModal()
    return () => {
      dialog.close()
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      className={className === undefined ? styles.dialog : `${styles.dialog} ${className}`}
      aria-labelledby={labelledBy}
      onCancel={(event) => {
        // Escape closes through the parent, so its state and the dialog never disagree.
        event.preventDefault()
        onClose()
      }}
      onClose={onClose}
    >
      {open ? children : null}
    </dialog>
  )
}
