import styles from './AboutButton.module.css'
import { useFirstRunStore } from './state/useFirstRunStore'

/** Props for {@link AboutButton}. */
interface AboutButtonProps {
  /** A ref to the button, so focus can return to it when the screen it opened closes. */
  readonly buttonRef?: React.Ref<HTMLButtonElement>
}

/**
 * A sidebar control that reopens the first-run screen.
 *
 * @example
 * <AboutButton />
 */
export function AboutButton({ buttonRef }: AboutButtonProps): React.JSX.Element {
  const open = useFirstRunStore((state) => state.open)

  return (
    <button ref={buttonRef} type="button" className={styles.button} onClick={open}>
      About Beekeeper
    </button>
  )
}
