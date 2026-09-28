import { toAgentId } from '../transcript/ids'
import type { SubagentMeta } from '../transcript/schemas'
import type { AgentTreeInput } from './agentTree'
import type { SubagentMetaStatus } from './subagentMetaStatus'

/**
 * Builds one subagent input for the hierarchy and tree tests.
 *
 * @param agentId - The subagent's id.
 * @param meta - The resolved meta, or `null` for a subagent whose meta is absent.
 * @returns The input, with its meta status set accordingly.
 */
export function buildTreeInput(
  agentId: string,
  meta: Record<string, unknown> | null
): AgentTreeInput {
  const metaStatus: SubagentMetaStatus =
    meta === null ? { status: 'absent' } : { status: 'ok', meta: meta as SubagentMeta }
  return { agentId: toAgentId(agentId), metaStatus }
}
