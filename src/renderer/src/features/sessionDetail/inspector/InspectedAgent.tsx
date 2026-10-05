import { useTranslation } from 'react-i18next'
import type { AgentGraphNode } from '../graph/agentGraphNode'
import { useSessionDetail } from '../useSessionDetail'
import styles from './AgentInspector.module.css'
import { inspectionOf } from './inspectionOf'
import type { InspectionTarget } from './inspectionTarget'
import { InspectorBody } from './InspectorBody'
import { InspectorFlags } from './InspectorFlags'
import { InspectorHeader } from './InspectorHeader'

/** Props for {@link InspectedAgent}. */
interface InspectedAgentProps {
  /** The selected node. */
  readonly node: AgentGraphNode
  /** Whose detail holds the node. */
  readonly target: InspectionTarget
}

/**
 * What the inspector shows for one agent, read from its owner session's
 * detail: who it is, and while that loads, once it can't be read, or once it
 * has loaded, its totals, files, worktree diff, and flags. Key it by the owner
 * session, so a different owner mounts a fresh reader instead of changing the
 * query key of the old one, which would refetch stale detail.
 *
 * @example
 * <InspectedAgent key={sessionKey(target.ownerRef)} node={node} target={target} />
 */
export function InspectedAgent({ node, target }: InspectedAgentProps): React.JSX.Element {
  const { t } = useTranslation('sessionDetail')
  // The view and the graph's teammate expansions keep this entry fresh; a click must not re-parse it.
  const { data, isError } = useSessionDetail(target.ownerRef, { refetchOnMount: false })
  const inspection = inspectionOf(target, { data, isError })

  return (
    <>
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
    </>
  )
}
