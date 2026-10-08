import { withClassName } from '@renderer/components/withClassName'
import styles from './SeriesFill.module.css'

/** The class of each series' color, by the series' index. */
const SERIES_CLASSES = [
  styles.series0,
  styles.series1,
  styles.series2,
  styles.series3,
  styles.series4
]

/** Props for {@link SeriesFill}. */
interface SeriesFillProps {
  /** The series' index, which picks its color. */
  readonly index: number
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
 * A block of a series' color: a swatch in the legend or a segment of a bar.
 * It is decorative: the series' name and figures are given in text.
 *
 * @example
 * <SeriesFill index={0} className={styles.swatch} />
 */
export function SeriesFill({ index, className, title, grow }: SeriesFillProps): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      className={withClassName(SERIES_CLASSES[index], className)}
      title={title}
      style={grow === undefined ? undefined : { flexGrow: grow }}
    />
  )
}
