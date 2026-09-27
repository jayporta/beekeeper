import { MAX_LABEL_CODE_UNITS } from './agentLabel'

/** A `name@team` string taken apart at its last `@`. */
export interface TeamSuffixSplit {
  /** Everything before the last `@`, or the whole string when it has none. */
  readonly name: string
  /** Everything after the last `@`, or `null` when the string has none. */
  readonly team: string | null
}

/**
 * Splits a `name@team` string at its last `@`, the form Claude Code uses for
 * a teammate's `agent_id` and sometimes for a `TaskStop` `task_id`. The
 * parts are raw, so the caller cleans them with `toAgentLabel`.
 *
 * The length gate lives here because a slice of a long string keeps the
 * whole string alive, so a crafted value must be refused before it is cut.
 * It is the agent label cap, and that module owns the number. A value over
 * it is refused whole, so an oversized team suffix discards a usable name
 * along with it.
 *
 * @param value - A string that may end in `@team`.
 * @returns The name and the team after the last `@`, `null` for the team
 * when there is none, or `null` when `value` is longer than an agent label.
 */
export function splitTeamSuffix(value: string): TeamSuffixSplit | null {
  if (value.length > MAX_LABEL_CODE_UNITS) return null

  const at = value.lastIndexOf('@')
  return at === -1
    ? { name: value, team: null }
    : { name: value.slice(0, at), team: value.slice(at + 1) }
}
