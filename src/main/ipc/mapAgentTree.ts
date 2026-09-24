import type { AgentTreeNode } from '../../core/session/agentTree'
import type { SubagentMetaStatus } from '../../core/session/subagentMetaStatus'
import type { AgentMetaStatusDto, AgentNodeDto } from '../../shared/ipc/agentDto'

function mapMetaStatus(status: SubagentMetaStatus): AgentMetaStatusDto {
  if (status.status !== 'ok') return status
  const { meta } = status
  return {
    status: 'ok',
    meta: {
      agentType: meta.agentType,
      description: meta.description,
      model: meta.model,
      toolUseId: meta.toolUseId,
      parentAgentId: meta.parentAgentId,
      spawnDepth: meta.spawnDepth,
      stoppedByUser: meta.stoppedByUser,
      worktreePath: meta.worktreePath,
      worktreeBranch: meta.worktreeBranch,
      teamName: meta.teamName,
      name: meta.name,
      taskKind: meta.taskKind,
      isFork: meta.isFork
    }
  }
}

/**
 * Maps an agent tree onto its transfer shape. Meta is copied field by field
 * from a whitelist, so a field Claude Code adds later never crosses the bridge.
 * @param node - The core tree node.
 * @returns The DTO node with its children mapped.
 */
export function mapAgentNode(node: AgentTreeNode): AgentNodeDto {
  return {
    agentId: node.identity.kind === 'lead' ? null : node.identity.agentId,
    meta: mapMetaStatus(node.metaStatus),
    isTeammate: node.isTeammate,
    children: node.children.map(mapAgentNode)
  }
}
