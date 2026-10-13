import { useMemo, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { MutedText } from '@renderer/components/MutedText'
import { Pill } from '@renderer/components/Pill'
import type { RootAgentGraphNode } from '../graph/agentGraphNode'
import { signalRanking } from './signalRanking'
import styles from './SignalsCard.module.css'
import { SummaryAgentRow } from './SummaryAgentRow'
import { SummaryCard } from './SummaryCard'
import { useSelectGraphAgent } from './useSelectGraphAgent'

/** Props for {@link SignalsCard}. */
interface SignalsCardProps {
  /** The graph before any teammate is opened, so the list doesn't change as one is selected. */
  readonly graph: RootAgentGraphNode
  /** The graph's region element, which pressing a row moves focus into. */
  readonly regionRef: RefObject<HTMLDivElement | null>
}

/**
 * The Signals card: the agents that had tool errors, most first, each with
 * its error count and, when it had a run of them in a row, its longest
 * streak. Pressing a row selects the agent and moves focus to its graph node.
 * A note says the count includes calls a hook blocked or a person denied.
 *
 * @example
 * <SignalsCard graph={graph.base} regionRef={regionRef} />
 */
export function SignalsCard({ graph, regionRef }: SignalsCardProps): React.JSX.Element {
  const { t } = useTranslation(['sessionDetail', 'sessions'])
  const select = useSelectGraphAgent(regionRef)
  const agents = useMemo(() => signalRanking(graph), [graph])

  return (
    <SummaryCard title={t('summary.signals.title')} caption={t('summary.signals.caption')}>
      {agents.length === 0 ? (
        <p className={styles.empty}>{t('summary.signals.empty')}</p>
      ) : (
        <ul className={styles.list}>
          {agents.map((node) => (
            <SummaryAgentRow
              key={node.key}
              name={node.name}
              className={styles.columns}
              onPress={() => {
                select(node)
              }}
            >
              <span>
                {node.marks.longestErrorStreak > 0 && (
                  <Pill tone="error">
                    {t('summary.signals.streak', { count: node.marks.longestErrorStreak })}
                  </Pill>
                )}
              </span>
              <span className={styles.count}>
                {t('sessions:stats.integer', { value: node.marks.toolErrors })}
              </span>
            </SummaryAgentRow>
          ))}
        </ul>
      )}
      <MutedText smaller>{t('inspector.signals.toolErrorsNote')}</MutedText>
    </SummaryCard>
  )
}
