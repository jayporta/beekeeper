import { useTranslation } from 'react-i18next'
import type { SessionRefDto } from '../../../../../shared/ipc/sessionRefDto'
import { sessionKey } from '@renderer/features/sessions/sessionKey'
import type { AgentGraphNode } from '../graph/agentGraphNode'
import styles from './AgentInspector.module.css'
import { InspectedAgent } from './InspectedAgent'
import { inspectionTarget } from './inspectionTarget'

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

  return (
    <section aria-label={t('inspector.label')} className={styles.inspector}>
      <InspectedAgent key={sessionKey(target.ownerRef)} node={node} target={target} />
    </section>
  )
}
