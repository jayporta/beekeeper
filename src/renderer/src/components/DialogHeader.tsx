import styles from './DialogHeader.module.css'

/** Props for {@link DialogHeader}. */
interface DialogHeaderProps {
  /** The id of the heading, for the dialog's `labelledBy`. */
  readonly headingId: string
  /** The heading text. */
  readonly heading: React.ReactNode
  /** The Close button's accessible name. The button shows an X in a circle. */
  readonly closeLabel: string
  /** Called when the Close button is pressed. */
  readonly onClose: () => void
  /** Extra content beneath the heading, such as a subtitle. */
  readonly children?: React.ReactNode
}

/**
 * The top row of a modal dialog: its heading, with any extra content beneath it,
 * and a round Close button with an X on the other side, named by `closeLabel`.
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
      <button type="button" className={styles.close} aria-label={closeLabel} onClick={onClose}>
        <svg className={styles.icon} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
        </svg>
      </button>
    </header>
  )
}
