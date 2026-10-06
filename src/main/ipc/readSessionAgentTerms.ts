import { NO_AGENT_TERMS, type AgentTerms } from '../../core/session/agentSearchTerms'
import type { SessionEntry } from '../../core/transcript/discoverSessions'
import { agentTermsKey } from './agentTermsCache'
import type { IpcDeps } from './ipcDeps'

/**
 * Reads the search terms of a session's subagents through the agent terms
 * cache, under the summaries scheduler. A session whose transcript couldn't be
 * read, with no subagents, or whose subagents couldn't be listed, has none and
 * costs no scheduler turn.
 *
 * @param entry - The session, as discovery found it.
 * @param deps - The agent terms cache and the summaries scheduler.
 * @returns The session's terms.
 */
export function readSessionAgentTerms(
  entry: SessionEntry,
  deps: Pick<IpcDeps, 'agentTerms' | 'summaries'>
): Promise<AgentTerms> {
  if (!entry.transcript.ok || !entry.subagents.ok || entry.subagents.value.length === 0) {
    return Promise.resolve(NO_AGENT_TERMS)
  }
  const subagents = entry.subagents.value
  return deps.summaries.run(`terms\0${agentTermsKey(subagents)}`, () =>
    deps.agentTerms.read(subagents)
  )
}
