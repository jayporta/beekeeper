import styles from './PageTitle.module.css'

/** Props for {@link PageTitle}. */
interface PageTitleProps {
  /** The title. */
  readonly children: React.ReactNode
  /** The heading's id, such as the one that names the main landmark. */
  readonly id?: string
}

/**
 * A page's `h1`, set large and bold, for the heading of a header card.
 *
 * @example
 * <PageTitle id={MAIN_HEADING_ID}>Overview</PageTitle>
 */
export function PageTitle({ children, id }: PageTitleProps): React.JSX.Element {
  return (
    <h1 id={id} className={styles.title}>
      {children}
    </h1>
  )
}
