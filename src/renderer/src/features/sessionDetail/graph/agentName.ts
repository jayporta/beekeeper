import type { AgentMetaStatusDto } from '../../../../../shared/ipc/agentDto'
import { shortId } from '@renderer/features/sessions/sessionLabel'

function nonBlank(text: string | undefined): string | undefined {
  return text !== undefined && text.trim() !== '' ? text : undefined
}

/**
 * Names a subagent: its name, else its description, else its type, else the
 * first characters of its agent id.
 *
 * @param meta - The subagent's meta status.
 * @param agentId - The subagent's id.
 * @returns The name. Transcript-derived: render as plain text.
 */
export function agentName(meta: AgentMetaStatusDto, agentId: string): string {
  if (meta.status !== 'ok') return shortId(agentId)
  const { name, description, agentType } = meta.meta
  return nonBlank(name) ?? nonBlank(description) ?? nonBlank(agentType) ?? shortId(agentId)
}
