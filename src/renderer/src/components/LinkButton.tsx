import styles from './LinkButton.module.css'

/** Props for {@link LinkButton}. */
interface LinkButtonProps {
  /** The button's text. */
  readonly children: React.ReactNode
  /** What the button does. */
  readonly onClick: () => void
  /**
   * Accent color at `--font-size-sm` for the box's main action, instead of text color at `--font-size-xs` for a secondary one.
   * @defaultValue false
   */
  readonly strong?: boolean
  /**
   * Sets the text at `--font-size-body`, to read at the size of the text around it, instead of its own smaller size.
   * @defaultValue false
   */
  readonly larger?: boolean
}

/**
 * A button that reads as an underlined link, for a secondary action such as one
 * inside an inspector box or in the sidebar footer.
 *
 * @example
 * <LinkButton strong onClick={openPatch}>Open patch</LinkButton>
 */
export function LinkButton({
  children,
  onClick,
  strong = false,
  larger = false
}: LinkButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      className={[styles.link, strong ? styles.strong : styles.quiet, larger && styles.larger]
        .filter(Boolean)
        .join(' ')}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
