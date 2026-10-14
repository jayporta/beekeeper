import { useLayoutEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { SessionRefDto } from '../../../../../shared/ipc/sessionRefDto'
import { Card } from '@renderer/components/Card'
import { sessionKey } from '../../../../../shared/sessions/sessionKey'
import type { AgentGraphNode } from '../../../../../shared/agentGraph/agentGraphNode'
import styles from './AgentInspector.module.css'
import { InspectedAgent } from './InspectedAgent'
import { InspectedWorkflow } from './InspectedWorkflow'

/** Props for {@link AgentInspector}. */
interface AgentInspectorProps {
  /** The selected node. */
  readonly node: AgentGraphNode
  /** The viewed session. */
  readonly sessionRef: SessionRefDto
}

/**
 * The drawer for the selected agent or workflow run, a region beside the graph: who it is, and
 * once its data has loaded, its totals, tokens by class, files touched,
 * worktree diff, and flags (a run shows its phases and its agents' tokens instead of files and a diff). A teammate in a session of its own, or a
 * subagent of one, reads that session's detail, which the graph has already
 * loaded when it opened the teammate. While that loads, or if it can't be read,
 * the drawer says so and shows who the agent is. It can scroll on its own
 * beside the graph, so selecting another agent scrolls it back to the top, and
 * it is a tab stop, so the keyboard can scroll it whatever it holds.
 *
 * @example
 * <AgentInspector node={node} sessionRef={ref} />
 */
export function AgentInspector({ node, sessionRef }: AgentInspectorProps): React.JSX.Element {
  const { t } = useTranslation('sessionDetail')
  const { selection } = node
  const region = useRef<HTMLElement>(null)
  // The region persists across selections, so the new agent would open at the old one's offset.
  useLayoutEffect(() => {
    if (region.current) region.current.scrollTop = 0
  }, [node.key])

  return (
    <Card
      ref={region}
      role="region"
      label={t('inspector.label')}
      tabIndex={0}
      className={styles.inspector}
    >
      {selection?.kind === 'workflow' ? (
        <InspectedWorkflow
          key={sessionKey(selection.ownerRef)}
          node={node}
          ownerRef={selection.ownerRef}
        />
      ) : (
        <InspectedAgent key={node.key} node={node} selection={selection} sessionRef={sessionRef} />
      )}
    </Card>
  )
}
