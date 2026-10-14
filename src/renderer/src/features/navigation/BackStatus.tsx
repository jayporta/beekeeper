/** Props for {@link BackStatus}. */
interface BackStatusProps {
  /** What to say, or an empty string for nothing. */
  readonly message: string
  /** How many messages have been announced. A new id mounts the text afresh, so a message equal to the last is announced again. */
  readonly id: number
}

/**
 * A polite status region, visible only to screen readers, that says what a
 * press of Back came to when it went nowhere. It is always rendered and empty
 * until there is a message, so the region exists before its text changes
 * (WCAG 4.1.3).
 *
 * @example
 * <BackStatus message={announcement.message} id={announcement.id} />
 */
export function BackStatus({ message, id }: BackStatusProps): React.JSX.Element {
  return (
    <p role="status" className="visuallyHidden">
      {message !== '' && <span key={id}>{message}</span>}
    </p>
  )
}
