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
   * Adds inline padding, to line the text up with padded text beside it.
   * @defaultValue false
   */
  readonly padded?: boolean
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
  padded = false
}: LinkButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      className={[styles.link, strong ? styles.strong : styles.quiet, padded && styles.padded]
        .filter(Boolean)
        .join(' ')}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
