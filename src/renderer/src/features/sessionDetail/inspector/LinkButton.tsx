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
}

/**
 * A button that reads as an underlined link, for an action inside an
 * inspector box.
 *
 * @example
 * <LinkButton strong onClick={openPatch}>Open patch</LinkButton>
 */
export function LinkButton({
  children,
  onClick,
  strong = false
}: LinkButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      className={`${styles.link} ${strong ? styles.strong : styles.quiet}`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
