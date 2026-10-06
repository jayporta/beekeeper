import type { AgentSearchTermDto } from '../../../../shared/ipc/sessionListDto'
import type { SessionRow } from './sessionRow'

/**
 * Prepares search text for matching: trimmed and lowercased.
 *
 * @param query - The text typed in the search box.
 * @returns The text to match against, empty when the search is blank.
 */
export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase()
}

/** Each term's fields as one lowercase string, so a keystroke lowercases nothing again. */
const lowercased = new WeakMap<readonly AgentSearchTermDto[], readonly string[]>()

/** A field separator no search text contains, so a match never spans two fields. */
const FIELD_SEPARATOR = '\0'

function lowercasedTerms(terms: readonly AgentSearchTermDto[]): readonly string[] {
  let texts = lowercased.get(terms)
  if (texts === undefined) {
    texts = terms.map(({ name, description, agentType }) =>
      [name, description, agentType].join(FIELD_SEPARATOR).toLowerCase()
    )
    lowercased.set(terms, texts)
  }
  return texts
}

/** The index of the first of a session's subagents whose name, description or type contains `needle`, or -1. */
function matchingTermIndex(row: SessionRow, needle: string): number {
  return lowercasedTerms(row.item.agentTerms).findIndex((text) => text.includes(needle))
}

/** Whether the row's own label contains `needle`. */
function labelMatches(row: SessionRow, needle: string): boolean {
  return row.label.text.toLowerCase().includes(needle)
}

/**
 * Whether a session matches the search text, ignoring case: its own label, or
 * the name, description or type of any of its subagents.
 *
 * @param row - The row to test.
 * @param needle - Search text from {@link normalizeQuery}.
 * @returns `true` when the row's own label or one of its own subagents matches.
 * Its teammates are not considered.
 */
export function rowMatches(row: SessionRow, needle: string): boolean {
  return labelMatches(row, needle) || matchingTermIndex(row, needle) >= 0
}

/**
 * Names the subagent a card should say it matches: the first of the session's
 * own subagents that matches, when nothing else on the card does. A match on
 * the session's label, or on a teammate (which the card's chips show), needs
 * no further note.
 *
 * @param row - The top-level row to test.
 * @param needle - Search text from {@link normalizeQuery}.
 * @returns The subagent's name, else its type, or `null` when the search is blank, the label or a teammate matches, or no subagent does.
 */
export function matchedAgentOf(row: SessionRow, needle: string): string | null {
  if (needle === '' || labelMatches(row, needle)) return null
  if (row.teammates.some((teammate) => rowMatches(teammate, needle))) return null

  const term = row.item.agentTerms[matchingTermIndex(row, needle)]
  return term === undefined ? null : (term.name ?? term.agentType)
}
