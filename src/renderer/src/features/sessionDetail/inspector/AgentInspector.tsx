import { useLayoutEffect, useRef } from 'react'
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
 * the drawer says so and shows who the agent is. Where the layout gives it its
 * own scroll area, selecting another agent scrolls it back to the top.
 *
 * @example
 * <AgentInspector node={node} sessionRef={ref} />
 */
export function AgentInspector({ node, sessionRef }: AgentInspectorProps): React.JSX.Element {
  const { t } = useTranslation('sessionDetail')
  const target = inspectionTarget(node, sessionRef)
  const region = useRef<HTMLElement>(null)
  // The section persists across selections, so the new agent would open at the old one's offset.
  useLayoutEffect(() => {
    if (region.current) region.current.scrollTop = 0
  }, [node.key])

  return (
    <section ref={region} aria-label={t('inspector.label')} className={styles.inspector}>
      <InspectedAgent key={sessionKey(target.ownerRef)} node={node} target={target} />
    </section>
  )
}
