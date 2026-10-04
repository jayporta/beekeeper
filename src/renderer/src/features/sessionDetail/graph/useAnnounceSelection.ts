import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AgentKey } from './agentGraphNode'

/** The node the graph has selected. */
export interface SelectedNode {
  /** The selected node's key. */
  readonly key: AgentKey
  /** The selected node's name. Transcript-derived. */
  readonly name: string
}

/**
 * Tells a person which node a press or Enter selected, since `aria-current`
 * alone is rarely announced. Only a change of the selected node is announced:
 * the node selected when the graph first shows, a press on the node that is
 * already selected, and the arrow keys moving focus around say nothing.
 *
 * @param selected - The selected node.
 * @param announce - Announces a message.
 */
export function useAnnounceSelection(
  selected: SelectedNode,
  announce: (message: string) => void
): void {
  const { t } = useTranslation('sessionDetail')
  const [previous, setPrevious] = useState(selected.key)
  if (previous !== selected.key) {
    setPrevious(selected.key)
    announce(t('graph.announce.selected', { name: selected.name }))
  }
}
