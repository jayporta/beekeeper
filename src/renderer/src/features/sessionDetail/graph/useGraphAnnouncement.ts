import type { AgentKey, RootAgentGraphNode } from './agentGraphNode'
import type { TeammateExpansion } from './teammateExpansion'
import { useAnnounceExpansions } from './useAnnounceExpansions'
import { useAnnounceSelection, type SelectedNode } from './useAnnounceSelection'
import { useAnnouncement } from '@renderer/components/useAnnouncement'

/** What the graph's status region reports on. */
interface GraphAnnouncementInput {
  /** The graph with the opened teammates' subagents under them. */
  readonly root: RootAgentGraphNode
  /** How each opened teammate's load stands, by node key. */
  readonly expansions: ReadonlyMap<AgentKey, TeammateExpansion>
  /** The selected node. */
  readonly selected: SelectedNode
}

/**
 * Gathers what the graph has to say, a teammate's load that settled and a
 * press that selected a node, into the text of one status region. Whichever
 * comes last is the one said, so a selection soon after a load is still heard.
 *
 * @param input - The graph, its loads, and its selection.
 * @returns The text for the region.
 */
export function useGraphAnnouncement({
  root,
  expansions,
  selected
}: GraphAnnouncementInput): string {
  const { message, announce } = useAnnouncement()
  useAnnounceExpansions({ root, expansions, announce })
  useAnnounceSelection(selected, announce)
  return message
}
