import styles from './Card.module.css'
import { withClassName } from './withClassName'

/** Props for {@link Card}. */
interface CardProps {
  /** The card's content. */
  readonly children: React.ReactNode
  /**
   * The element to render: `section` for a titled group, `header` for a page's header.
   * @defaultValue 'div'
   */
  readonly as?: 'div' | 'section' | 'header'
  /** The id of the heading that names a `section`, so it is a labelled region. */
  readonly labelledBy?: string
  /**
   * Marks the card busy while its content loads or refreshes.
   * @defaultValue Not set.
   */
  readonly busy?: boolean
  /**
   * Removes the card's padding, for a card whose parts pad themselves, such as a header over a full-width canvas.
   * @defaultValue false
   */
  readonly flush?: boolean
  /**
   * A class that adds to the card's own rules, such as its layout.
   * @defaultValue No extra class.
   */
  readonly className?: string
}

/**
 * A raised white panel with a rounded edge: the ground a screen's groups sit on.
 *
 * @example
 * <Card as="section" labelledBy="projects-title">
 *   <h2 id="projects-title">Projects</h2>
 * </Card>
 */
export function Card({
  children,
  as: Element = 'div',
  labelledBy,
  busy,
  flush = false,
  className
}: CardProps): React.JSX.Element {
  return (
    <Element
      aria-labelledby={labelledBy}
      aria-busy={busy}
      className={withClassName(flush ? `${styles.card} ${styles.flush}` : styles.card, className)}
    >
      {children}
    </Element>
  )
}
