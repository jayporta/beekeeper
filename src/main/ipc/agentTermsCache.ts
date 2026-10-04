import { collectAgentTerms, type AgentTerms } from '../../core/session/agentSearchTerms'
import { createLruMap } from '../../core/shared/lruMap'
import type { SubagentEntry } from '../../core/transcript/discoverSubagents'
import type { SubagentMetaStatus } from '../../core/session/subagentMetaStatus'

/**
 * The default bound on the cache's total weight, in UTF-16 code units. A real
 * session's entry weighs a few thousand, and the strings a full cache holds
 * take at most 8 MB, at two bytes per code unit.
 */
export const AGENT_TERMS_CACHE_MAX_WEIGHT = 4_000_000

/** The weight charged for each entry beyond its strings: the entry and term objects. */
const ENTRY_OVERHEAD = 512

/** Keeps the search terms of each session's subagents, so listing rereads only metas that may have changed. */
export interface AgentTermsCache {
  /**
   * Returns the search terms of a session's subagents, reading their meta
   * files only when nothing is cached for exactly these subagents.
   *
   * @param subagents - The session's subagents, as discovery found them.
   * @returns The terms, none for a session with no subagents.
   */
  read(subagents: readonly SubagentEntry[]): Promise<AgentTerms>
}

/** Options for {@link createAgentTermsCache}. */
export interface AgentTermsCacheOptions {
  /**
   * The most total weight, in UTF-16 code units, the cache keeps.
   * @defaultValue {@link AGENT_TERMS_CACHE_MAX_WEIGHT}
   */
  readonly maxWeight?: number
  /** Resolves a meta path. Defaults to `resolveSubagentMeta`; injectable for tests. */
  readonly readMeta?: (metaPath: string) => Promise<SubagentMetaStatus>
}

/**
 * Identifies a session's subagents by what discovery stat'd: each
 * transcript's path, modification time and size, and whether it has a meta
 * file. A subagent that spawns, or a transcript that grows, changes it.
 *
 * @param subagents - The session's subagents.
 * @returns The key.
 */
export function agentTermsKey(subagents: readonly SubagentEntry[]): string {
  return subagents
    .map(
      ({ transcript, metaPath }) =>
        `${transcript.path}\0${transcript.mtimeMs}\0${transcript.size}\0${metaPath === null ? 0 : 1}`
    )
    .join('\n')
}

function weigh(key: string, value: AgentTerms): number {
  let weight = ENTRY_OVERHEAD + key.length
  for (const { name, description, agentType } of value.terms) {
    weight += (name?.length ?? 0) + (description?.length ?? 0) + (agentType?.length ?? 0)
  }
  return weight
}

/**
 * Creates a terms cache, keyed by {@link agentTermsKey} so a change to a
 * session's subagents is a miss. Entries are evicted least recently used
 * first once their total weight passes the bound, and an entry heavier than
 * the whole bound is served but not kept. Terms are kept only when every
 * meta file that exists was read: an unreadable one may recover without the
 * key changing. Meta files are assumed write-once, so the key covers their
 * presence and not their contents.
 *
 * @param options - The weight bound and the meta reader.
 * @returns An empty cache.
 */
export function createAgentTermsCache(options: AgentTermsCacheOptions = {}): AgentTermsCache {
  const { maxWeight = AGENT_TERMS_CACHE_MAX_WEIGHT, readMeta } = options
  const entries = createLruMap<string, { key: string; terms: AgentTerms }>({
    maxWeight,
    weigh: ({ key, terms }) => weigh(key, terms)
  })

  return {
    async read(subagents) {
      const key = agentTermsKey(subagents)
      const hit = entries.get(key)
      if (hit !== undefined) return hit.terms

      const { terms, truncated, complete } = await collectAgentTerms(subagents, readMeta)
      const collected: AgentTerms = { terms, truncated }
      if (complete) entries.set(key, { key, terms: collected })
      return collected
    }
  }
}
