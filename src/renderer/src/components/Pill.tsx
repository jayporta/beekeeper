import styles from './Pill.module.css'

/** The color a {@link Pill} takes: what kind of thing it flags. */
export type PillTone = 'error' | 'warning' | 'neutral' | 'info' | 'success' | 'edit'

/** Props for {@link Pill}. */
interface PillProps {
  /** Which kind of note it is: `error` and `warning` for trouble, `neutral` for a state, `info` for a match, `success` for something created, `edit` for something changed. */
  readonly tone: PillTone
  /** The pill's text. */
  readonly children: React.ReactNode
}

/**
 * A small rounded label for a status, such as a count of tool errors or a
 * session that was stopped. It has no role: the text is read where it sits.
 *
 * @example
 * <Pill tone="error">2 tool errors</Pill>
 */
export function Pill({ tone, children }: PillProps): React.JSX.Element {
  return <span className={`${styles.pill} ${styles[tone]}`}>{children}</span>
}
