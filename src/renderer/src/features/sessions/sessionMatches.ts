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

/** The run names lowercased once per array, for the same reason as {@link lowercased}. */
const lowercasedRunNames = new WeakMap<readonly string[], readonly string[]>()

function lowercasedRuns(names: readonly string[]): readonly string[] {
  let texts = lowercasedRunNames.get(names)
  if (texts === undefined) {
    texts = names.map((name) => name.toLowerCase())
    lowercasedRunNames.set(names, texts)
  }
  return texts
}

/** The index of the first of a session's workflow runs whose name contains `needle`, or -1. */
function matchingRunIndex(row: SessionRow, needle: string): number {
  return lowercasedRuns(row.item.workflowRunNames).findIndex((text) => text.includes(needle))
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
 * Whether a session matches the search text, ignoring case: its own label,
 * the name of any of its workflow runs, or the name, description or type of
 * any of its subagents.
 *
 * @param row - The row to test.
 * @param needle - Search text from {@link normalizeQuery}.
 * @returns `true` when the row's own label, one of its own workflow runs, or
 * one of its own subagents matches. Its teammates are not considered.
 */
export function rowMatches(row: SessionRow, needle: string): boolean {
  return (
    labelMatches(row, needle) ||
    matchingRunIndex(row, needle) >= 0 ||
    matchingTermIndex(row, needle) >= 0
  )
}

/** What a card says its search matches the session through. */
export interface SessionMatch {
  /** Whether a workflow run or a subagent matched. */
  readonly kind: 'workflow' | 'subagent'
  /** The workflow's name, or the subagent's name, else its type. */
  readonly name: string
}

/**
 * Names the workflow or subagent a card should say it matches: the first of
 * the session's own workflow runs that matches, else the first of its own
 * subagents, when nothing else on the card does. A run wins over a subagent
 * because its name stands for the whole run. A match on the session's label,
 * or on a teammate (which the card's chips show), needs no further note.
 *
 * @param row - The top-level row to test.
 * @param needle - Search text from {@link normalizeQuery}.
 * @returns The match, or `null` when the search is blank, the label or a
 * teammate matches, or no workflow run or subagent does.
 */
export function matchOf(row: SessionRow, needle: string): SessionMatch | null {
  if (needle === '' || labelMatches(row, needle)) return null
  if (row.teammates.some((teammate) => rowMatches(teammate, needle))) return null

  const run = row.item.workflowRunNames[matchingRunIndex(row, needle)]
  if (run !== undefined) return { kind: 'workflow', name: run }

  const term = row.item.agentTerms[matchingTermIndex(row, needle)]
  return term === undefined ? null : { kind: 'subagent', name: term.name ?? term.agentType }
}
