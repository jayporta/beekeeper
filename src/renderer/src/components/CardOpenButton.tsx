import styles from './CardOpenButton.module.css'
import { withClassName } from './withClassName'

/** Props for {@link CardOpenButton}. */
interface CardOpenButtonProps {
  /** The button's text, which names what it opens. */
  readonly children: React.ReactNode
  /** Opens what the card stands for. */
  readonly onClick: () => void
  /**
   * Ids of elements that describe the button.
   * @defaultValue No description.
   */
  readonly describedBy?: string
  /**
   * A class that adds to the button's own rules.
   * @defaultValue No extra class.
   */
  readonly className?: string
}

/**
 * The button that names a card and opens it. It stretches over its positioned
 * card, so the whole card is one target, and carries `data-card-open` for the
 * card to show its focus ring by.
 *
 * @example
 * <CardOpenButton onClick={openProject}>my-project</CardOpenButton>
 */
export function CardOpenButton({
  children,
  onClick,
  describedBy,
  className
}: CardOpenButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      className={withClassName(styles.open, className)}
      data-card-open=""
      aria-describedby={describedBy}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
