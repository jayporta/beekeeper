import { agentIdentityKey, type AgentIdentity } from './agentIdentity'

/** Anything a session-wide ledger tracks per owning agent. */
interface Owned {
  readonly owner: AgentIdentity
}

/**
 * Groups ledger entries by their owning agent, keyed by
 * {@link agentIdentityKey}. Shared by the usage and files ledgers, whose
 * entries both carry an `owner`, so a session scan groups either the same way.
 *
 * @param entries - Every entry a ledger has seen, in first-reported order.
 * @returns A map from each owner's identity key to its entries, in the
 * order they appeared in `entries`.
 */
export function groupByOwner<T extends Owned>(entries: readonly T[]): ReadonlyMap<string, T[]> {
  const byOwner = new Map<string, T[]>()

  for (const entry of entries) {
    const key = agentIdentityKey(entry.owner)
    const group = byOwner.get(key)
    if (group) {
      group.push(entry)
    } else {
      byOwner.set(key, [entry])
    }
  }

  return byOwner
}
