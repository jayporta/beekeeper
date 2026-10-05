import { useTranslation } from 'react-i18next'
import type { SessionRefDto } from '../../../../../shared/ipc/sessionRefDto'
import type { AgentGraphNode } from '../graph/agentGraphNode'
import { useSessionDetail } from '../useSessionDetail'
import styles from './AgentInspector.module.css'
import { inspectionOf } from './inspectionOf'
import { inspectionTarget } from './inspectionTarget'
import { InspectorBody } from './InspectorBody'
import { InspectorFlags } from './InspectorFlags'
import { InspectorHeader } from './InspectorHeader'

/** Props for {@link AgentInspector}. */
interface AgentInspectorProps {
  /** The selected node. */
  readonly node: AgentGraphNode
  /** The viewed session. */
  readonly sessionRef: SessionRefDto
}

/**
 * The drawer for the selected agent, a region beside the graph: who it is, and
 * once its data has loaded, its totals, tokens by class, files touched,
 * worktree diff, and flags. A teammate in a session of its own, or a
 * subagent of one, reads that session's detail, which the graph has already
 * loaded when it opened the teammate. While that loads, or if it can't be read,
 * the drawer says so and shows who the agent is.
 *
 * @example
 * <AgentInspector node={node} sessionRef={ref} />
 */
export function AgentInspector({ node, sessionRef }: AgentInspectorProps): React.JSX.Element {
  const { t } = useTranslation('sessionDetail')
  const target = inspectionTarget(node, sessionRef)
  // The view and the graph's teammate expansions keep this entry fresh; a click must not re-parse it.
  const { data, isError } = useSessionDetail(target.ownerRef, { refetchOnMount: false })
  const inspection = inspectionOf(target, { data, isError })

  return (
    <section aria-label={t('inspector.label')} className={styles.inspector}>
      <InspectorHeader
        node={node}
        report={inspection.status === 'ready' ? inspection.report : null}
      />
      {inspection.status === 'loading' && (
        <p className={styles.note} role="status">
          {t('inspector.loading')}
        </p>
      )}
      {inspection.status === 'unreadable' && (
        <>
          <p className={styles.note}>{t('inspector.unreadable')}</p>
          <InspectorFlags stopped={node.stopped} partial={false} />
        </>
      )}
      {inspection.status === 'ready' && (
        <InspectorBody node={node} target={target} inspection={inspection} />
      )}
    </section>
  )
}
