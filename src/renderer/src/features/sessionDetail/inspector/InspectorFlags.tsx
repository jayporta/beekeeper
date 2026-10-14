import { useTranslation } from 'react-i18next'
import { Pill } from '@renderer/components/Pill'
import { InspectorMarker } from './InspectorMarker'
import styles from './InspectorFlags.module.css'

/** Props for {@link InspectorFlags}. */
interface InspectorFlagsProps {
  /** Whether the agent was stopped. */
  readonly stopped: boolean
  /** Whether the agent's data is partial, which adds a mark that points at the footnote. */
  readonly partial: boolean
}

/**
 * Warning pills for what is notable about the agent: that it was stopped, and
 * that its transcript is partial. It renders nothing when neither applies.
 *
 * @example
 * <InspectorFlags stopped partial={false} />
 */
export function InspectorFlags({
  stopped,
  partial
}: InspectorFlagsProps): React.JSX.Element | null {
  const { t } = useTranslation('sessionDetail')
  if (!stopped && !partial) return null

  return (
    <ul className={styles.flags}>
      {stopped && (
        <li>
          <Pill tone="warning">{t('inspector.flags.stopped')}</Pill>
        </li>
      )}
      {partial && (
        <li>
          <Pill tone="warning">
            {t('inspector.flags.partial')}
            <InspectorMarker />
          </Pill>
        </li>
      )}
    </ul>
  )
}
