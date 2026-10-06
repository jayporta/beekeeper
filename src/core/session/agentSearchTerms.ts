import type { SubagentEntry } from '../transcript/discoverSubagents'
import { MAX_AGENT_TERM_CODE_UNITS, MAX_AGENT_TERMS } from './agentTermCaps'
import { resolveSubagentMeta } from './resolveSubagentMeta'
import type { SubagentMetaFailureReason, SubagentMetaStatus } from './subagentMetaStatus'

/** What a session search matches on for one subagent. Transcript-derived text. */
export interface AgentSearchTerm {
  /** The subagent's name, or `null` when its meta has none. */
  readonly name: string | null
  /** The subagent's task description, or `null` when its meta has none. */
  readonly description: string | null
  /** The subagent's type, or `null` when its meta has none. */
  readonly agentType: string | null
}

/** A session's subagent search terms. */
export interface AgentTerms {
  /** The distinct terms, in agent id order, within the caps. */
  readonly terms: readonly AgentSearchTerm[]
  /** Whether a further distinct term was left out because a cap was reached. */
  readonly truncated: boolean
}

/** Terms for a session that has none to give. */
export const NO_AGENT_TERMS: AgentTerms = { terms: [], truncated: false }

/** A session's {@link AgentTerms} and whether every meta that exists could be read. */
export interface CollectedAgentTerms extends AgentTerms {
  /**
   * `false` when a meta file existed but failed in a way that can clear
   * without the subagents changing (see {@link isTransientMetaFailure}), so
   * such terms aren't kept.
   */
  readonly complete: boolean
}

/** The failures that can clear on their own: the file may be mid-write, or briefly unreadable. */
const TRANSIENT_META_FAILURES: ReadonlySet<SubagentMetaFailureReason> = new Set([
  'unreadable',
  'missing',
  'invalid-json'
])

/**
 * Whether a meta failure can clear without the file being replaced. The
 * others (`invalid-shape`, `too-large`, `symlink`, `not-a-file`) describe the
 * file as it stands and repeat on every read.
 */
function isTransientMetaFailure(reason: SubagentMetaFailureReason): boolean {
  return TRANSIENT_META_FAILURES.has(reason)
}

function lengthOf(term: AgentSearchTerm): number {
  return (term.name?.length ?? 0) + (term.description?.length ?? 0) + (term.agentType?.length ?? 0)
}

/**
 * Collects the search terms of a session's subagents from their meta files,
 * one file at a time. A subagent with no meta, or whose meta can't be read,
 * adds nothing, and only a transient failure makes the result incomplete.
 * Terms are deduplicated on name, description and type. The collection stops
 * at the first distinct term that would pass {@link MAX_AGENT_TERMS} terms or
 * {@link MAX_AGENT_TERM_CODE_UNITS} code units, and reports `truncated`.
 *
 * @param subagents - The session's subagents, in agent id order.
 * @param readMeta - Resolves a meta path. Defaults to `resolveSubagentMeta`.
 * @returns The terms, whether they were cut, and whether every meta was read.
 */
export async function collectAgentTerms(
  subagents: readonly SubagentEntry[],
  readMeta: (metaPath: string) => Promise<SubagentMetaStatus> = resolveSubagentMeta
): Promise<CollectedAgentTerms> {
  const terms: AgentSearchTerm[] = []
  const seen = new Set<string>()
  let codeUnits = 0
  let complete = true

  for (const { metaPath } of subagents) {
    if (metaPath === null) continue
    const status = await readMeta(metaPath)
    if (status.status === 'error' && isTransientMetaFailure(status.reason)) complete = false
    if (status.status !== 'ok') continue

    const term: AgentSearchTerm = {
      name: status.meta.name ?? null,
      description: status.meta.description ?? null,
      agentType: status.meta.agentType
    }
    const key = JSON.stringify([term.name, term.description, term.agentType])
    if (seen.has(key)) continue

    if (terms.length >= MAX_AGENT_TERMS || codeUnits + lengthOf(term) > MAX_AGENT_TERM_CODE_UNITS) {
      return { terms, truncated: true, complete }
    }
    seen.add(key)
    terms.push(term)
    codeUnits += lengthOf(term)
  }
  return { terms, truncated: false, complete }
}
