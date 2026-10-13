import { withClassName } from '@renderer/components/withClassName'
import type { ModelFamily } from './modelFamily'
import styles from './SeriesFill.module.css'

/** The class of each family's color. */
const FAMILY_CLASSES = {
  fable: styles.fable,
  opus: styles.opus,
  sonnet: styles.sonnet,
  haiku: styles.haiku,
  other: styles.other
} as const satisfies Record<ModelFamily, string | undefined>

/** Props for {@link SeriesFill}. */
interface SeriesFillProps {
  /** The model family, which picks the fill's color and pattern. */
  readonly family: ModelFamily
  /**
   * A class that sizes and places the fill.
   * @defaultValue No extra class.
   */
  readonly className?: string
  /** A native tooltip for the fill. */
  readonly title?: string
  /** How much of its container's main axis the fill takes, relative to its siblings (it shares the space by `flex-grow`): its tokens in a stack. */
  readonly grow?: number
}

/**
 * A block of a model family's color: a swatch in the legend or a segment of a bar.
 * Haiku carries dots and other carries a hatch, so neither relies on color alone.
 * It is decorative: the family's name and figures are given in text.
 *
 * @example
 * <SeriesFill family="opus" className={styles.swatch} />
 */
export function SeriesFill({ family, className, title, grow }: SeriesFillProps): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      className={withClassName(FAMILY_CLASSES[family], className)}
      title={title}
      style={grow === undefined ? undefined : { flexGrow: grow }}
    />
  )
}
