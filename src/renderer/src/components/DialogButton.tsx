import styles from './DialogButton.module.css'

/** Props for {@link DialogButton}. */
interface DialogButtonProps {
  /** The button's text. */
  readonly children: React.ReactNode
  /** What the button does. */
  readonly onClick: () => void
}

/**
 * A bordered button for a dialog's actions, such as Close or Copy, at least as
 * large as the minimum touch target.
 *
 * @example
 * <DialogButton onClick={copy}>Copy</DialogButton>
 */
export function DialogButton({ children, onClick }: DialogButtonProps): React.JSX.Element {
  return (
    <button type="button" className={styles.button} onClick={onClick}>
      {children}
    </button>
  )
}
