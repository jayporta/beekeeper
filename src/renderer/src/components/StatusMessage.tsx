import styles from './StatusMessage.module.css'

/** Props for {@link StatusMessage}. */
interface StatusMessageProps {
  /** The message's heading, rendered as the view's `h1`. */
  readonly heading: string
  /** One or two sentences of explanation. */
  readonly body?: string
  /**
   * The live-region role, for a message that appears without the person asking.
   * @defaultValue No role.
   */
  readonly role?: 'status' | 'alert'
  /** An action, such as a retry button, shown under the body. */
  readonly children?: React.ReactNode
}

/**
 * A view that says why there is nothing to show: a heading, an explanation,
 * and an optional action.
 *
 * @example
 * <StatusMessage heading="No sessions found" body="Run Claude Code to create one." />
 */
export function StatusMessage({
  heading,
  body,
  role,
  children
}: StatusMessageProps): React.JSX.Element {
  return (
    <div className={styles.message} role={role}>
      <h1 className={styles.heading}>{heading}</h1>
      {body !== undefined && <p className={styles.body}>{body}</p>}
      {children}
    </div>
  )
}
