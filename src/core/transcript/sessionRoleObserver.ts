import type { SessionRole } from './sessionRole'

/**
 * The longest agent type, agent name, or team name kept, in UTF-16 code
 * units, so a character outside the Basic Multilingual Plane counts as two.
 * Real values run under ~30 code units; the cap exists because a transcript
 * is untrusted input and a summary sits in a cache for as long as the app
 * runs.
 */
const MAX_ROLE_FIELD_CODE_UNITS = 256

/**
 * Characters no real value carries and a label can't safely show: control,
 * format, surrogate and private-use code points, and any whitespace other
 * than a plain space, which covers the line and paragraph separators too.
 * A name is shown as a label and joins a session to its team, so a value
 * carrying a newline, a bidi override, U+2028, or a non-breaking space could
 * misrepresent either.
 */
const UNPRINTABLE_PATTERN = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}]|[^\S ]/u

/** Classifies a transcript as a lead or agent session from the records it observes. */
export interface SessionRoleObserver {
  /** Feeds one parsed record, in file order. Records without agent markers are ignored. */
  observe(record: Record<string, unknown>): void
  /** The role the records observed so far indicate: a lead until a marker is seen. */
  role(): SessionRole
}

/**
 * A printable string within the cap that isn't blank, trimmed and normalized
 * to NFC, or `null`. The cap is checked before anything scans the value, so
 * an oversized one costs nothing, and again after normalizing, since NFC
 * expands a code point excluded from composition rather than shortening it.
 * Trimming and normalizing matter because these values name a session's team
 * and agent: `"scout "` and `"scout"`, or a precomposed and a decomposed
 * spelling of one name, display identically, and storing both verbatim would
 * show one agent as two.
 */
function usable(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > MAX_ROLE_FIELD_CODE_UNITS) return null
  if (UNPRINTABLE_PATTERN.test(value)) return null

  const trimmed = value.trim().normalize('NFC')
  if (trimmed === '' || trimmed.length > MAX_ROLE_FIELD_CODE_UNITS) return null
  return trimmed
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
        agentType ??= usable(record.agentSetting)
      } else if (type === 'user' || type === 'assistant') {
        const rawName = record.agentName
        const rawTeam = record.teamName
        if (typeof rawName !== 'string' && typeof rawTeam !== 'string') return
        isAgent = true
        agentName ??= usable(rawName)
        teamName ??= usable(rawTeam)
      } else {
        return
      }
      complete = agentType !== null && agentName !== null && teamName !== null
    },
    role: () => (isAgent ? { kind: 'agent', agentType, agentName, teamName } : { kind: 'lead' })
  }
}
