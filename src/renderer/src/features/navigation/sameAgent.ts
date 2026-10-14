import { sameSessionRef } from './sameSessionRef'
import type { SelectedAgent } from './state/useNavigationStore'

/**
 * Whether two selections pick the same agent: the same kind, in the same
 * session, with the same id. `null`, which stands for the lead, matches only
 * itself.
 *
 * @param a - One selection, or `null` for the lead.
 * @param b - The other selection, or `null` for the lead.
 * @returns `true` when both pick the same agent.
 */
export function sameAgent(a: SelectedAgent | null, b: SelectedAgent | null): boolean {
  if (a === null || b === null) return a === b
  switch (a.kind) {
    case 'subagent':
      return (
        b.kind === 'subagent' && a.agentId === b.agentId && sameSessionRef(a.ownerRef, b.ownerRef)
      )
    case 'teammate':
      return b.kind === 'teammate' && sameSessionRef(a.ref, b.ref)
    case 'workflow':
      return b.kind === 'workflow' && a.runId === b.runId && sameSessionRef(a.ownerRef, b.ownerRef)
  }
}
