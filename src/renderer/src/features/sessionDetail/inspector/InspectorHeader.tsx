import { useTranslation } from 'react-i18next'
import type { AgentReportDto } from '../../../../../shared/ipc/agentDto'
import { formatDuration } from '@renderer/features/sessions/formatDuration'
import { SeparatedText } from '@renderer/features/sessions/SeparatedText'
import type { AgentGraphNode } from '../graph/agentGraphNode'
import styles from './InspectorHeader.module.css'
import { inspectorKicker } from './inspectorKicker'

/** A run's id for the facts line, left out when the run is already named by it. */
function runIdFact(node: AgentGraphNode): string | null {
  const { workflow } = node
  return workflow === null || workflow.name === workflow.runId ? null : workflow.runId
}

/** Props for {@link InspectorHeader}. */
interface InspectorHeaderProps {
  /** The inspected node. */
  readonly node: AgentGraphNode
  /** The agent's report, or `null` while it isn't known, which leaves out the span and the message count. */
  readonly report: AgentReportDto | null
}

/**
 * Who the inspector is showing: a kicker for what kind of agent it is, its
 * name as a heading under the page's own, and a line of its model, how long
 * it was active, and how many messages it sent. A workflow run shows its id in
 * place of a model, so same-named runs read apart. Any part that is unknown is
 * left out.
 *
 * @example
 * <InspectorHeader node={node} report={report} />
 */
export function InspectorHeader({ node, report }: InspectorHeaderProps): React.JSX.Element {
  const { t } = useTranslation('sessionDetail')
  const { t: tSessions } = useTranslation('sessions')

  const facts = [
    node.kind === 'workflow' ? runIdFact(node) : node.model,
    report === null ? null : formatDuration(report.activity, tSessions),
    report === null ? null : t('inspector.messages', { count: report.messageCount })
  ].filter((part) => part !== null)

  return (
    <header className={styles.header}>
      <p className={styles.kicker}>
        <bdi>{inspectorKicker(node, t)}</bdi>
      </p>
      <h2 className={styles.name}>
        <bdi>{node.name}</bdi>
      </h2>
      {facts.length > 0 && (
        <p className={styles.facts}>
          <bdi>
            <SeparatedText parts={facts} />
          </bdi>
        </p>
      )}
    </header>
  )
}
