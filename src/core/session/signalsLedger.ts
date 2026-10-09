import { signalEventKey, type SignalEvent } from '../transcript/signals/signalEvent'
import { agentIdentityKey, type AgentIdentity } from './agentIdentity'

/**
 * The most signal events one session's ledger keeps, across every agent. Each
 * transcript is capped on its own, but a session can hold any number of
 * subagent transcripts, so without a total a crafted one could still make
 * millions of events. Real sessions peak near 2,300 events. An event past the
 * cap is not kept, and the agent that reported it is marked capped.
 */
export const MAX_SIGNAL_EVENTS_PER_SESSION = 16_384

/** One signal event as tracked by the signals ledger. */
export interface SignalEntry {
  /** The agent that owns this event: the first one to report its key. */
  readonly owner: AgentIdentity
  /** The event itself. */
  readonly event: SignalEvent
}

/** One agent's report of a signal event. */
export interface SignalReport {
  /** The reporting agent. */
  readonly identity: AgentIdentity
  /** The event being reported. */
  readonly event: SignalEvent
}

/**
 * Tracks signal events across every agent's transcript in one session, so an
 * event copied into more than one transcript (a fork repeating the lead's
 * history) is credited to exactly one agent: whichever reports its key first
 * owns it.
 */
export interface SignalsLedger {
  /**
   * Records one agent's report of an event. The first agent to report a key
   * (see {@link signalEventKey}) owns it; a later report of that key changes
   * nothing, whoever sends it, including the owner repeating a duplicated
   * line. A new key past {@link MAX_SIGNAL_EVENTS_PER_SESSION} is not kept and
   * marks the reporting agent capped.
   */
  report(report: SignalReport): void
  /** Marks an agent's signals partial outright, as when its own transcript hit the per-transcript cap. */
  markCapped(identity: AgentIdentity): void
  /** Every event the ledger has seen, in first-reported order. */
  entries(): readonly SignalEntry[]
  /** The {@link agentIdentityKey} of each agent whose signals may be low because events were dropped. */
  cappedOwners(): ReadonlySet<string>
}

/**
 * Creates an empty {@link SignalsLedger}.
 * @returns A new, empty ledger.
 */
export function createSignalsLedger(): SignalsLedger {
  const byKey = new Map<string, SignalEntry>()
  const capped = new Set<string>()

  return {
    report({ identity, event }) {
      const key = signalEventKey(event)
      if (byKey.has(key)) return
      if (byKey.size >= MAX_SIGNAL_EVENTS_PER_SESSION) {
        capped.add(agentIdentityKey(identity))
        return
      }
      byKey.set(key, { owner: identity, event })
    },
    markCapped(identity) {
      capped.add(agentIdentityKey(identity))
    },
    entries() {
      return [...byKey.values()]
    },
    cappedOwners() {
      return capped
    }
  }
}
