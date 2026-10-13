import type { AgentGraphWords } from '../../../shared/agentGraph/buildAgentGraph'
import type { SessionLabelWords } from '../../../shared/sessions/sessionLabel'
import { t } from '../../i18n/modI18n'

/** The words the shared session label and agent graph use, from the mod's locale. */
export const PANE_WORDS: {
  readonly label: SessionLabelWords
  readonly graph: AgentGraphWords
} = {
  label: {
    unreadable: t('words.unreadable'),
    untitled: t('words.untitled'),
    agentName: (name, type) => t('words.agentName', { name, type })
  },
  graph: { lead: t('words.lead'), teammate: t('words.teammate') }
}
