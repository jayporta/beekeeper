import type { AgentId } from '../transcript/ids'

/** The lead session reported a usage record. */
export interface LeadIdentity {
  /** Discriminant for {@link AgentIdentity}. */
  readonly kind: 'lead'
}

/** A subagent reported a usage record. */
export interface SubagentIdentity {
  /** Discriminant for {@link AgentIdentity}. */
  readonly kind: 'subagent'
  /** The reporting subagent's id. */
  readonly agentId: AgentId
}

/**
 * Which agent reported a usage record: the lead session, or one of its
 * subagents. A discriminated union rather than a bare id, since a
 * subagent's {@link AgentId} could literally be the string `"lead"`.
 */
export type AgentIdentity = LeadIdentity | SubagentIdentity

/** The lead session's identity. */
export const leadIdentity: LeadIdentity = { kind: 'lead' }

/**
 * Builds a subagent's identity.
 * @param agentId - The subagent's id.
 * @returns The subagent's identity.
 */
export function subagentIdentity(agentId: AgentId): SubagentIdentity {
  return { kind: 'subagent', agentId }
}

/**
 * A stable, unique string key for an agent identity, for use as a `Map` key.
 * @param identity - The identity to key.
 * @returns `'lead'` for the lead, or a key incorporating the subagent's id.
 */
export function agentIdentityKey(identity: AgentIdentity): string {
  return identity.kind === 'lead' ? 'lead' : `subagent:${identity.agentId}`
}

/**
 * Compares two agent identities for equality, via {@link agentIdentityKey}
 * so "same agent" has one source of truth.
 * @param a - The first identity.
 * @param b - The second identity.
 * @returns Whether `a` and `b` identify the same agent.
 */
export function agentIdentityEquals(a: AgentIdentity, b: AgentIdentity): boolean {
  return agentIdentityKey(a) === agentIdentityKey(b)
}
