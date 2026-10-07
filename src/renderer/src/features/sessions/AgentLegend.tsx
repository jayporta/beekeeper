import { useTranslation } from 'react-i18next'
import { MutedText } from '@renderer/components/MutedText'
import { AgentMark } from './AgentMark'
import type { AgentMarkKind } from './agentMarks'
import styles from './AgentLegend.module.css'

/** Props for {@link AgentLegend}. */
interface AgentLegendProps {
  /** The kinds of mark to explain, in order. Nothing renders when it is empty. */
  readonly kinds: readonly AgentMarkKind[]
}

/**
 * A key to the agent strips' marks: each given kind's mark followed by its
 * word. It is hidden from assistive technology, as the strips are, since each
 * card's agent count says the same in words.
 *
 * @example
 * <AgentLegend kinds={['lead', 'teammate']} />
 */
export function AgentLegend({ kinds }: AgentLegendProps): React.JSX.Element | null {
  const { t } = useTranslation('sessions')
  if (kinds.length === 0) return null

  return (
    <MutedText as="div" smaller decorative className={styles.legend}>
      {kinds.map((kind) => (
        <span key={kind} className={styles.item}>
          <AgentMark kind={kind} /> {t(`legend.${kind}`)}
        </span>
      ))}
    </MutedText>
  )
}
