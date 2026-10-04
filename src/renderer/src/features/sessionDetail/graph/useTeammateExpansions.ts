import { useQueries } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import type { SessionDetailDto } from '../../../../../shared/ipc/sessionDetailDto'
import type { SessionRefDto } from '../../../../../shared/ipc/sessionRefDto'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { sessionKey } from '@renderer/features/sessions/sessionKey'
import { sessionDetailQueryOptions } from '../sessionDetailQuery'
import type { AgentKey, RootAgentGraphNode } from './agentGraphNode'
import { expansionOf, type TeammateExpansion } from './teammateExpansion'

/** A teammate node and the session it stands for. */
interface TeammateEntry {
  readonly key: AgentKey
  readonly ref: SessionRefDto
}

/** What a loading teammate's detail query tells the graph, kept small so the combined result stays stable. */
interface QueryFacts {
  readonly data: SessionDetailDto | undefined
  readonly isError: boolean
}

const NO_EXPANSIONS: ReadonlyMap<AgentKey, TeammateExpansion> = new Map()

function toFacts(results: readonly QueryFacts[]): QueryFacts[] {
  return results.map(({ data, isError }) => ({ data, isError }))
}

/**
 * Loads the sessions of the teammates the person has opened. A teammate
 * opens when its node is selected, or when the session was opened with it
 * selected, and stays open after the selection moves on. The load shares
 * its cache entry with the teammate's own session view.
 *
 * @param base - The graph before any teammate's subagents are added.
 * @returns How each opened teammate's load stands, by node key. It keeps its identity while nothing changes.
 */
export function useTeammateExpansions(
  base: RootAgentGraphNode
): ReadonlyMap<AgentKey, TeammateExpansion> {
  const selectedAgent = useNavigationStore((state) => state.selectedAgent)
  const [opened, setOpened] = useState<readonly AgentKey[]>([])

  const teammates = useMemo(
    () =>
      base.children.flatMap(({ key, selection }): TeammateEntry[] =>
        selection?.kind === 'teammate' ? [{ key, ref: selection.ref }] : []
      ),
    [base]
  )

  const selected =
    selectedAgent?.kind === 'teammate'
      ? teammates.find(({ ref }) => sessionKey(ref) === sessionKey(selectedAgent.ref))
      : undefined
  if (selected !== undefined && !opened.includes(selected.key)) {
    setOpened([...opened, selected.key])
  }

  const active = useMemo(
    () => teammates.filter(({ key }) => opened.includes(key)),
    [teammates, opened]
  )
  const facts = useQueries({
    queries: active.map(({ ref }) => sessionDetailQueryOptions(ref)),
    combine: toFacts
  })

  return useMemo(() => {
    if (active.length === 0) return NO_EXPANSIONS
    return new Map(
      active.map(({ key, ref }, index) => [
        key,
        expansionOf(facts[index] ?? { data: undefined, isError: false }, ref)
      ])
    )
  }, [active, facts])
}
