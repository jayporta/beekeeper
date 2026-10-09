import styles from './MutedText.module.css'
import { withClassName } from './withClassName'

/** The props every {@link MutedText} takes. */
interface MutedTextBaseProps {
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
  /** The element's id, so a figure can describe itself by it. */
  readonly id?: string
  /**
   * A class that adds to the text's own rules.
   * @defaultValue No extra class.
   */
  readonly className?: string
}

/** A note that repeats what is already announced, so it takes no role: an aria-hidden status is never announced. */
interface DecorativeMutedTextProps extends MutedTextBaseProps {
  /** Hides the text from assistive technology, for a note that repeats what is already announced. */
  readonly decorative: true
  /** Not allowed on decorative text, which assistive technology never reaches. */
  readonly role?: never
}

/** A note that assistive technology reads, optionally as a live status. */
interface AnnouncedMutedTextProps extends MutedTextBaseProps {
  /**
   * Hides the text from assistive technology when `true`.
   * @defaultValue false
   */
  readonly decorative?: false
  /** An ARIA role for a note that is announced, such as a loading note. Omit it for a plain note. */
  readonly role?: 'status'
}

/** Props for {@link MutedText}: decorative text takes no role. */
type MutedTextProps = DecorativeMutedTextProps | AnnouncedMutedTextProps

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
  role,
  id,
  className
}: MutedTextProps): React.JSX.Element {
  const own = [styles.muted, smaller && styles.smaller, wrapAnywhere && styles.wrapAnywhere]
    .filter(Boolean)
    .join(' ')

  return (
    <Element
      id={id}
      role={role}
      className={withClassName(own, className)}
      aria-hidden={decorative || undefined}
    >
      {children}
    </Element>
  )
}
