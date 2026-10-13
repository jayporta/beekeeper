import type { SessionLabelWords } from '../../../../shared/sessions/sessionLabel'
import type { SessionsT } from './sessionsT'

/**
 * The session label words in the UI language.
 *
 * @param t - The sessions translate function.
 * @returns The words `sessionLabel` and `groupSessionRows` name sessions with.
 */
export function sessionLabelWords(t: SessionsT): SessionLabelWords {
  return {
    unreadable: t('label.unreadable'),
    untitled: t('label.untitled'),
    agentName: (name, type) => t('agentName', { name, type })
  }
}
