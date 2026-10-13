import styles from './ShareBar.module.css'
import { withClassName } from './withClassName'

/** Props for {@link ShareBar}. */
interface ShareBarProps {
  /** How much of the track to fill, from 0 to 1. A value outside that range, or not a number, is clamped. */
  readonly share: number
  /**
   * `regular` is a 6px bar on a tinted track. `thin` is 4px on the card's ground, for a row inside a tinted panel.
   * @defaultValue 'regular'
   */
  readonly size?: 'regular' | 'thin'
  /**
   * A class that adds to the track's own rules, such as its place in a grid.
   * @defaultValue No extra class.
   */
  readonly className?: string
}

/**
 * A bar that shows a share of a whole. It is decorative: the figure it
 * illustrates is always written out beside it, so assistive technology skips it.
 *
 * @example
 * <ShareBar share={0.4} />
 */
export function ShareBar({ share, size = 'regular', className }: ShareBarProps): React.JSX.Element {
  const clamped = Number.isFinite(share) ? Math.min(1, Math.max(0, share)) : 0

  return (
    <div className={withClassName(`${styles.track} ${styles[size]}`, className)} aria-hidden="true">
      <div className={styles.fill} style={{ inlineSize: `${clamped * 100}%` }} />
    </div>
  )
}
