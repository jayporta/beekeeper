import { useTranslation } from 'react-i18next'
import { AgentMark } from './AgentMark'
import { agentMarks } from './agentMarks'
import styles from './AgentStrip.module.css'
import type { SessionListItemDto } from '../../../../shared/ipc/sessionListDto'

/** Props for {@link AgentStrip}. */
interface AgentStripProps {
  /** The session whose agents to draw. */
  readonly item: SessionListItemDto
}

/**
 * A row of marks for a session's agents: a filled square for a lead, a solid
 * outlined square for each teammate, a double-bordered square for each
 * workflow run, and a smaller dashed square for each subagent, then "+N" for any the marks leave out. It is hidden from
 * assistive technology, since the card's agent count says the same in words.
 *
 * @example
 * <AgentStrip item={item} />
 */
export function AgentStrip({ item }: AgentStripProps): React.JSX.Element {
  const { t } = useTranslation('sessions')
  const { marks, overflow } = agentMarks(item)

  return (
    <div className={styles.strip} aria-hidden="true">
      {marks.map((kind, index) => (
        // The marks are interchangeable and never reorder, so the position is the identity.
        <AgentMark key={index} kind={kind} />
      ))}
      {overflow > 0 && (
        <span className={styles.more}>{t('agentStrip.more', { count: overflow })}</span>
      )}
    </div>
  )
}
