import { CapsText } from '@renderer/components/CapsText'
import styles from './InspectorHeading.module.css'

/** Props for {@link InspectorHeading}. */
interface InspectorHeadingProps {
  /** The heading's content, which names what follows it. */
  readonly children: React.ReactNode
}

/**
 * A small muted heading in capitals, one level under the inspector's own.
 *
 * @example
 * <InspectorHeading>Phases</InspectorHeading>
 */
export function InspectorHeading({ children }: InspectorHeadingProps): React.JSX.Element {
  return (
    <CapsText as="h3" className={styles.heading}>
      {children}
    </CapsText>
  )
}
