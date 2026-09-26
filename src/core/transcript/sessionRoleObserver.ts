import { toAgentLabel } from './agentLabel'
import type { SessionRole } from './sessionRole'

/** Classifies a transcript as a lead or agent session from the records it observes. */
export interface SessionRoleObserver {
  /** Feeds one parsed record, in file order. Records without agent markers are ignored. */
  observe(record: Record<string, unknown>): void
  /** The role the records observed so far indicate: a lead until a marker is seen. */
  role(): SessionRole
}

/**
 * Creates a reducer that classifies a transcript. Two things mark an agent
 * session: an `agent-setting` record, whatever its `agentSetting` field
 * holds, and a `user` or `assistant` record carrying a string `agentName` or
 * `teamName`. A non-string `agentName` and `teamName` leave such a record no
 * marker at all, since only the field's presence as a string distinguishes a
 * teammate's record from a lead's. Standalone `agent-name` records, which
 * leads also carry, never mark one.
 *
 * The first usable value of each field is kept, and a blank, oversized or
 * unprintable value is dropped without costing the classification, so a
 * marked transcript stays an agent session with a `null` field.
 *
 * @returns A reducer ready to `observe` a transcript's records in order.
 */
export function createSessionRoleObserver(): SessionRoleObserver {
  let isAgent = false
  let agentType: string | null = null
  let agentName: string | null = null
  let teamName: string | null = null
  let complete = false

  return {
    observe(record) {
      if (complete) return
      const type = record.type
      if (type === 'agent-setting') {
        isAgent = true
        agentType ??= toAgentLabel(record.agentSetting)
      } else if (type === 'user' || type === 'assistant') {
        const rawName = record.agentName
        const rawTeam = record.teamName
        if (typeof rawName !== 'string' && typeof rawTeam !== 'string') return
        isAgent = true
        agentName ??= toAgentLabel(rawName)
        teamName ??= toAgentLabel(rawTeam)
      } else {
        return
      }
      complete = agentType !== null && agentName !== null && teamName !== null
    },
    role: () => (isAgent ? { kind: 'agent', agentType, agentName, teamName } : { kind: 'lead' })
  }
}
