import styles from './Footnote.module.css'

/** Props for {@link Footnote}. */
interface FootnoteProps {
  /** The id of the paragraph, so a figure can describe itself by it. */
  readonly id: string
  /** The footnote's lead-in, such as the "¹" and what it marks. */
  readonly label: string
  /** The explanations, in the order to give them. Nothing renders when it is empty. */
  readonly sentences: readonly string[]
}

/**
 * A muted note that explains the "¹" on partial figures: a label, then each
 * sentence, as one paragraph.
 *
 * @example
 * <Footnote id="footnote" label="¹ Partial." sentences={['Some lines were unreadable.']} />
 */
export function Footnote({ id, label, sentences }: FootnoteProps): React.JSX.Element | null {
  if (sentences.length === 0) return null

  return (
    <p id={id} className={styles.footnote}>
      {label} {sentences.join(' ')}
    </p>
  )
}
