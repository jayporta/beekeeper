import styles from './DialogHeader.module.css'

/** Props for {@link DialogHeader}. */
interface DialogHeaderProps {
  /** The id of the heading, for the dialog's `labelledBy`. */
  readonly headingId: string
  /** The heading text. */
  readonly heading: React.ReactNode
  /** The Close button's text. */
  readonly closeLabel: string
  /** Called when the Close button is pressed. */
  readonly onClose: () => void
  /** Extra content beneath the heading, such as a subtitle. */
  readonly children?: React.ReactNode
}

/**
 * The top row of a modal dialog: its heading, with any extra content beneath it,
 * and a Close button on the other side.
 *
 * @example
 * <DialogHeader headingId={id} heading={t('heading')} closeLabel={t('close')} onClose={close}>
 *   <p>{subtitle}</p>
 * </DialogHeader>
 */
export function DialogHeader({
  headingId,
  heading,
  closeLabel,
  onClose,
  children
}: DialogHeaderProps): React.JSX.Element {
  return (
    <header className={styles.header}>
      <div className={styles.title}>
        <h2 id={headingId} className={styles.heading}>
          {heading}
        </h2>
        {children}
      </div>
      <button type="button" className={styles.close} onClick={onClose}>
        {closeLabel}
      </button>
    </header>
  )
}
