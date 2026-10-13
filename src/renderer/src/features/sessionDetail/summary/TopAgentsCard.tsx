import { useMemo, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { PartialMarker } from '@renderer/components/PartialMarker'
import { ShareBar } from '@renderer/components/ShareBar'
import type { RootAgentGraphNode } from '../graph/agentGraphNode'
import { SummaryAgentRow } from './SummaryAgentRow'
import { SummaryCard } from './SummaryCard'
import styles from './TopAgentsCard.module.css'
import { topAgents } from './topAgents'
import { useSelectGraphAgent } from './useSelectGraphAgent'

/** Props for {@link TopAgentsCard}. */
interface TopAgentsCardProps {
  /** The graph before any teammate is opened, so the list doesn't change as one is selected. */
  readonly graph: RootAgentGraphNode
  /** The session's total tokens, which each agent's share is taken of, or `null` when unknown. */
  readonly teamTotal: number | null
  /** The graph's region element, which pressing a row moves focus into. */
  readonly regionRef: RefObject<HTMLDivElement | null>
}

/**
 * The Most tokens card: the six agents that used the most tokens, each with a
 * bar against the top agent, its tokens, and its share of the session's total.
 * Pressing a row selects the agent and moves focus to its graph node.
 *
 * @example
 * <TopAgentsCard graph={graph.base} teamTotal={3_100_000} regionRef={regionRef} />
 */
export function TopAgentsCard({
  graph,
  teamTotal,
  regionRef
}: TopAgentsCardProps): React.JSX.Element {
  const { t } = useTranslation(['sessionDetail', 'sessions'])
  const select = useSelectGraphAgent(regionRef)
  const rows = useMemo(() => topAgents(graph, teamTotal), [graph, teamTotal])

  return (
    <SummaryCard title={t('summary.topAgents.title')} caption={t('summary.topAgents.caption')}>
      {rows.length === 0 ? (
        <p className={styles.empty}>{t('summary.topAgents.empty')}</p>
      ) : (
        <ul className={styles.list}>
          {rows.map(({ node, tokens, bar, share }) => (
            <SummaryAgentRow
              key={node.key}
              name={node.name}
              className={styles.columns}
              onPress={() => {
                select(node)
              }}
            >
              <ShareBar share={bar} size="thin" />
              <span className={styles.figure}>
                {t('graph.node.tokensShort', { count: tokens })}
                {node.partial && <PartialMarker note={t('graph.node.partial')} />}
              </span>
              <span className={styles.share}>
                {share !== null && t('sessions:teammate.share', { value: share })}
              </span>
            </SummaryAgentRow>
          ))}
        </ul>
      )}
    </SummaryCard>
  )
}
