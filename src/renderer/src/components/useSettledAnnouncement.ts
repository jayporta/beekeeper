import { useReducer } from 'react'
import { useAnnouncement } from './useAnnouncement'

/** What {@link useSettledAnnouncement} reports on. */
export interface SettledAnnouncementInput<Scope extends string, Outcome extends string> {
  /** What the data is for, such as its window. A change starts a new announcement. */
  readonly scope: Scope
  /** Whether all of the scope's data has arrived, with none showing a previous scope's. */
  readonly settled: boolean
  /** What the data came to. */
  readonly outcome: Outcome
  /** The words for an outcome of a scope. */
  readonly say: (outcome: Outcome, scope: Scope) => string
}

/** What the hook remembers between renders. */
interface AnnouncementState<Scope extends string, Outcome extends string> {
  /** Whether the scope's data is still to be announced, because it is loading or the scope changed. */
  readonly pending: boolean
  /** The scope the state is for. */
  readonly scope: Scope
  /** The outcome last announced, or the one showing when the hook was first used. */
  readonly outcome: Outcome
}

type AnnouncementAction<Scope extends string, Outcome extends string> =
  | { readonly type: 'scopeChanged'; readonly scope: Scope }
  | { readonly type: 'unsettled' }
  | { readonly type: 'announced'; readonly outcome: Outcome }

function announcementReducer<Scope extends string, Outcome extends string>(
  state: AnnouncementState<Scope, Outcome>,
  action: AnnouncementAction<Scope, Outcome>
): AnnouncementState<Scope, Outcome> {
  switch (action.type) {
    case 'scopeChanged':
      return { ...state, scope: action.scope, pending: true }
    case 'unsettled':
      return { ...state, pending: true }
    case 'announced':
      return { ...state, pending: false, outcome: action.outcome }
  }
}

/**
 * The text for a polite status region that reports on data that loads: once
 * all of it has arrived, what it came to. It says it once per arrival, not per
 * part, for the first load and after each change of scope or reload. Once
 * settled it also says so when the outcome changes, such as data that loads
 * after a failure, and says nothing for a refresh that leaves the outcome as it
 * was. Data that was already in when the hook was first used says nothing.
 *
 * @param input - The scope, whether its data has settled, what it came to, and the words for an outcome.
 * @returns The text to show in the region. It is empty until there is news, and again after the hidden live copy's clear delay.
 */
export function useSettledAnnouncement<Scope extends string, Outcome extends string>({
  scope,
  settled,
  outcome,
  say
}: SettledAnnouncementInput<Scope, Outcome>): string {
  const { message, announce } = useAnnouncement()
  const [state, dispatch] = useReducer(announcementReducer<Scope, Outcome>, {
    pending: !settled,
    scope,
    outcome
  })

  if (scope !== state.scope) {
    dispatch({ type: 'scopeChanged', scope })
  } else if (!settled && !state.pending) {
    dispatch({ type: 'unsettled' })
  } else if (settled && (state.pending || outcome !== state.outcome)) {
    dispatch({ type: 'announced', outcome })
    announce(say(outcome, scope))
  }
  return message
}
