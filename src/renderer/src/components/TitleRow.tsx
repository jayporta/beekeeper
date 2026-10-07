import styles from './TitleRow.module.css'

/** Props for {@link TitleRow}. */
interface TitleRowProps {
  /** The heading block, then its actions. */
  readonly children: React.ReactNode
  /**
   * The element to render: `header` when the row is the page's header.
   * @defaultValue 'div'
   */
  readonly as?: 'div' | 'header'
}

/**
 * A page's title row: the heading block on the left and its actions on the
 * right, wrapping onto a second line when they don't fit.
 *
 * @example
 * <TitleRow>
 *   <div><h1>Projects</h1></div>
 *   <div><button type="button">Refresh</button></div>
 * </TitleRow>
 */
export function TitleRow({ children, as: Element = 'div' }: TitleRowProps): React.JSX.Element {
  return <Element className={styles.row}>{children}</Element>
}
