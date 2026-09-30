import styles from './AboutButton.module.css'
import { selectIsFirstRunShowing, useFirstRunStore } from './state/useFirstRunStore'

/** Props for {@link AboutButton}. */
interface AboutButtonProps {
  /** A ref to the button, so focus can return to it when the screen it opened closes. */
  readonly buttonRef?: React.Ref<HTMLButtonElement>
}

/**
 * A sidebar control that reopens the first-run screen. It is hidden while that
 * screen shows.
 *
 * @example
 * <AboutButton />
 */
export function AboutButton({ buttonRef }: AboutButtonProps): React.JSX.Element | null {
  const open = useFirstRunStore((state) => state.open)
  const isFirstRunShowing = useFirstRunStore(selectIsFirstRunShowing)

  // While the screen shows, the button would only reopen what is already open.
  if (isFirstRunShowing) return null

  return (
    <button ref={buttonRef} type="button" className={styles.button} onClick={open}>
      About Beekeeper
    </button>
  )
}
