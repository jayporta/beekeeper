import styles from './CapsText.module.css'
import { withClassName } from './withClassName'

/** Props for {@link CapsText}. */
interface CapsTextProps {
  /** The text. */
  readonly children: React.ReactNode
  /**
   * The element to render.
   * @defaultValue 'p'
   */
  readonly as?: 'p' | 'span' | 'h3'
  /**
   * Colors the text with the accent, for a kicker above a title, instead of muted, for a label.
   * @defaultValue false
   */
  readonly accent?: boolean
  /** The element's id, so a list or region can be labelled by it. */
  readonly id?: string
  /**
   * A class that adds to the text's own rules.
   * @defaultValue No extra class.
   */
  readonly className?: string
}

/**
 * Small text in capitals, muted for a label or accented for a kicker.
 *
 * @example
 * <CapsText accent>Last 7 days</CapsText>
 */
export function CapsText({
  children,
  as: Element = 'p',
  accent = false,
  id,
  className
}: CapsTextProps): React.JSX.Element {
  const own = `${styles.caps} ${accent ? styles.accent : styles.muted}`

  return (
    <Element id={id} className={withClassName(own, className)}>
      {children}
    </Element>
  )
}
