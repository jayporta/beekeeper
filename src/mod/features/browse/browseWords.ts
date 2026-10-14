import type { AgentCountWords } from '../../../shared/sessions/agentCountLabel'
import type { SessionLabelWords } from '../../../shared/sessions/sessionLabel'
import { PANE_WORDS } from '../pane/paneWords'
import { t } from '../../i18n/modI18n'

/** The words the Browse data uses to name sessions and count agents. */
export interface BrowseWords {
  /** The session label words. */
  readonly label: SessionLabelWords
  /** The agent count words. */
  readonly agentCount: AgentCountWords
}

/** The Browse words, from the mod's locale. */
export const BROWSE_WORDS: BrowseWords = {
  label: PANE_WORDS.label,
  agentCount: {
    teammates: (count) => t('agents.teammates', { count }),
    subagents: (count) => t('agents.subagents', { count }),
    workflows: (count, agents) => t('agents.workflows', { count, agents }),
    workflowAgents: (count) => t('agents.workflowAgents', { count }),
    separator: t('agents.separator'),
    none: t('agents.none')
  }
}
