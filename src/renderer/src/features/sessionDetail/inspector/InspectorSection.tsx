import { InspectorHeading } from './InspectorHeading'
import styles from './InspectorSection.module.css'

/** Props for {@link InspectorSection}. */
interface InspectorSectionProps {
  /** The heading's content, which is the section's name. */
  readonly heading: React.ReactNode
  /** What the section holds under its heading. */
  readonly children: React.ReactNode
}

/**
 * A titled section of the inspector: a small muted heading in capitals under
 * the inspector's own, then what it holds.
 *
 * @example
 * <InspectorSection heading="Phases">
 *   <ol>…</ol>
 * </InspectorSection>
 */
export function InspectorSection({ heading, children }: InspectorSectionProps): React.JSX.Element {
  return (
    <section className={styles.section}>
      <InspectorHeading>{heading}</InspectorHeading>
      {children}
    </section>
  )
}
