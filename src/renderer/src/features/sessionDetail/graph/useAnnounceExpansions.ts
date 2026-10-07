import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AgentGraphNode, AgentKey, RootAgentGraphNode } from './agentGraphNode'
import { flattenPreorder } from './flattenPreorder'
import type { TeammateExpansion } from './teammateExpansion'

/** What {@link useAnnounceExpansions} needs. */
interface AnnounceExpansionsInput {
  /** The graph with the opened teammates' subagents under them, which names the teammates. */
  readonly root: RootAgentGraphNode
  /** How each opened teammate's load stands, by node key. */
  readonly expansions: ReadonlyMap<AgentKey, TeammateExpansion>
  /** Announces a message. */
  readonly announce: (message: string) => void
}

/** How many agents a load added: every generation of them, leaving out the workflow runs that group some. */
function agentsAdded(children: readonly AgentGraphNode[]): number {
  return children
    .flatMap((child) => flattenPreorder(child).nodes)
    .filter((node) => node.kind !== 'workflow').length
}

/**
 * Tells what an opened teammate's session load came to, once, so a person who
 * can't see the subagents appear or the node turn partial hears of it. A load
 * is announced the first time it settles: with how many subagents it added
 * (every generation of them, workflow runs not counted), or that it failed. A teammate selected again
 * later, or a load that is still going, says nothing. If several settle in one
 * render, the last is the one announced.
 *
 * @param input - The graph, its loads, and where to announce.
 */
export function useAnnounceExpansions({
  root,
  expansions,
  announce
}: AnnounceExpansionsInput): void {
  const { t } = useTranslation('sessionDetail')
  const [seen, setSeen] = useState<ReadonlySet<string>>(new Set())

  const fresh = [...expansions].flatMap(([key, expansion]) => {
    const name = root.children.find((child) => child.key === key)?.name
    const id = `${key}:${expansion.status}`
    return expansion.status === 'loading' || name === undefined || seen.has(id)
      ? []
      : [{ id, name, expansion }]
  })
  const newest = fresh.at(-1)
  if (newest !== undefined) {
    setSeen(new Set([...seen, ...fresh.map(({ id }) => id)]))
    const { name, expansion } = newest
    announce(
      expansion.status === 'ready'
        ? t('graph.announce.loaded', { count: agentsAdded(expansion.children), name })
        : t('graph.announce.failed', { name })
    )
  }
}
