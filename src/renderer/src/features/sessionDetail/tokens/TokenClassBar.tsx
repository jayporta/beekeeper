import { withClassName } from '@renderer/components/withClassName'
import styles from './TokenClassBar.module.css'
import type { TokenClassTotal } from './tokenClasses'

/** Props for {@link TokenClassBar}. */
interface TokenClassBarProps {
  /** The classes to show, from `tokenClasses`. */
  readonly classes: readonly TokenClassTotal[]
  /**
   * `regular` is 10px tall, `small` is 8px.
   * @defaultValue 'regular'
   */
  readonly size?: 'regular' | 'small'
}

/**
 * A segmented bar of an agent's tokens by class, each segment as wide as its
 * share of the total. A class with no tokens is not drawn, and a bar with no
 * tokens at all draws nothing. It is decorative: `TokenClassRows` writes the
 * figures out, so assistive technology skips the bar.
 *
 * @example
 * <TokenClassBar classes={tokenClasses(reports)} />
 */
export function TokenClassBar({
  classes,
  size = 'regular'
}: TokenClassBarProps): React.JSX.Element | null {
  const total = classes.reduce((sum, { tokens }) => sum + tokens, 0)
  if (total <= 0) return null

  return (
    <div className={withClassName(styles.bar, styles[size])} aria-hidden="true">
      {classes
        .filter(({ tokens }) => tokens > 0)
        .map(({ tokenClass, tokens }) => (
          <div
            key={tokenClass}
            className={`${styles.segment} ${styles[tokenClass]}`}
            style={{ inlineSize: `${(tokens / total) * 100}%` }}
          />
        ))}
    </div>
  )
}
