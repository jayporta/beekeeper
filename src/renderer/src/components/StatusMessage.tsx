import styles from './StatusMessage.module.css'
import { MAIN_HEADING_ID } from './mainHeading'

/** Props for {@link StatusMessage}. */
interface StatusMessageProps {
  /** The message's heading. */
  readonly heading: string
  /**
   * The heading level: 1 when the message is the whole view, 2 when it sits under the view's own `h1`.
   * A level 1 heading names the main landmark (see `MAIN_HEADING_ID`).
   * @defaultValue 1
   */
  readonly headingLevel?: 1 | 2
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
  headingLevel = 1,
  body,
  role,
  children
}: StatusMessageProps): React.JSX.Element {
  const Heading = headingLevel === 1 ? 'h1' : 'h2'
  return (
    <div className={styles.message} role={role}>
      <Heading id={headingLevel === 1 ? MAIN_HEADING_ID : undefined} className={styles.heading}>
        {heading}
      </Heading>
      {body !== undefined && <p className={styles.body}>{body}</p>}
      {children}
    </div>
  )
}
