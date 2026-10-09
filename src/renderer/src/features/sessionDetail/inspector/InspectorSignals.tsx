import { useTranslation } from 'react-i18next'
import type { AgentSignalsDto } from '../../../../../shared/ipc/agentDto'
import { MutedText } from '@renderer/components/MutedText'
import { InspectorMarker } from './InspectorMarker'
import { InspectorSection } from './InspectorSection'
import styles from './InspectorSignals.module.css'
import { signalRows } from './signalRows'

/** Props for {@link InspectorSignals}. */
interface InspectorSignalsProps {
  /** The agent's signal counts. */
  readonly signals: AgentSignalsDto
  /** Whether to show the agents killed count, which only an agent in a session of its own can have. */
  readonly showKills: boolean
}

/**
 * The agent's signs of going off the rails as terms and figures: tool errors,
 * repeated Bash commands, compactions, agents killed, and the longest tool
 * wait. The heading carries the "¹" marker, once, when the counts may be low.
 *
 * @example
 * <InspectorSignals signals={report.signals} showKills />
 */
export function InspectorSignals({ signals, showKills }: InspectorSignalsProps): React.JSX.Element {
  const { t } = useTranslation('sessionDetail')
  const { t: tSessions } = useTranslation('sessions')

  return (
    <InspectorSection
      heading={
        <>
          {t('inspector.signals.heading')}
          {signals.partial && <InspectorMarker />}
        </>
      }
    >
      <dl className={styles.rows}>
        {signalRows({ signals, showKills, tSessions }, t).map((row) => (
          <div key={row.key} className={styles.row}>
            <dt>{row.label}</dt>
            <dd className={styles.value}>
              <bdi>{row.value}</bdi>
            </dd>
          </div>
        ))}
      </dl>
      {signals.toolErrors > 0 && <MutedText>{t('inspector.signals.toolErrorsNote')}</MutedText>}
      {signals.longestToolWait !== null && <MutedText>{t('inspector.signals.waitNote')}</MutedText>}
    </InspectorSection>
  )
}
