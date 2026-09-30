import styles from './AboutButton.module.css'
import { useFirstRunStore } from './state/useFirstRunStore'

/**
 * A sidebar control that reopens the first-run screen.
 *
 * @example
 * <AboutButton />
 */
export function AboutButton(): React.JSX.Element {
  const open = useFirstRunStore((state) => state.open)

  return (
    <button type="button" className={styles.button} onClick={open}>
      About Beekeeper
    </button>
  )
}
