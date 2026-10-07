import styles from './InspectorNote.module.css'

/** Props for {@link InspectorNote}. */
interface InspectorNoteProps {
  /** The note's text. */
  readonly children: React.ReactNode
  /** An ARIA role for a note that is announced, such as a loading note. Omit it for a plain note. */
  readonly role?: 'status'
}

/**
 * A muted line of small text in the inspector: a note under its totals, or one
 * that says its data is loading or can't be read.
 *
 * @example
 * <InspectorNote>2 agents</InspectorNote>
 */
export function InspectorNote({ children, role }: InspectorNoteProps): React.JSX.Element {
  return (
    <p className={styles.note} role={role}>
      {children}
    </p>
  )
}
