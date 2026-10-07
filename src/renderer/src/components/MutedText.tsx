import styles from './MutedText.module.css'
import { withClassName } from './withClassName'

/** Props for {@link MutedText}. */
interface MutedTextProps {
  /** The text. */
  readonly children: React.ReactNode
  /**
   * The element to render.
   * @defaultValue 'p'
   */
  readonly as?: 'p' | 'span' | 'div'
  /**
   * Sets the text a step smaller, for a footnote or a sub-line.
   * @defaultValue false
   */
  readonly smaller?: boolean
  /**
   * Lets a long unbroken value, such as a folder name, wrap at any character.
   * @defaultValue false
   */
  readonly wrapAnywhere?: boolean
  /**
   * Hides the text from assistive technology, for a note that repeats what is already announced.
   * @defaultValue false
   */
  readonly decorative?: boolean
  /** The element's id, so a figure can describe itself by it. */
  readonly id?: string
  /**
   * A class that adds to the text's own rules.
   * @defaultValue No extra class.
   */
  readonly className?: string
}

/**
 * Muted small text: a note, a caption, or a figure's label.
 *
 * @example
 * <MutedText wrapAnywhere>{folder}</MutedText>
 */
export function MutedText({
  children,
  as: Element = 'p',
  smaller = false,
  wrapAnywhere = false,
  decorative = false,
  id,
  className
}: MutedTextProps): React.JSX.Element {
  const own = [styles.muted, smaller && styles.smaller, wrapAnywhere && styles.wrapAnywhere]
    .filter(Boolean)
    .join(' ')

  return (
    <Element
      id={id}
      className={withClassName(own, className)}
      aria-hidden={decorative || undefined}
    >
      {children}
    </Element>
  )
}
