import { useTranslation } from 'react-i18next'
import { StatRowItem } from '@renderer/components/StatRowItem'
import { EmptyCell } from '@renderer/features/sessions/EmptyCell'
import { InspectorCostStat } from './InspectorCostStat'
import type { ReportCost } from './reportCost'

/** Props for {@link WorkflowTotals}. */
interface WorkflowTotalsProps {
  /** The run's tokens: its agents' added up, or `null` when none has any recorded. */
  readonly tokens: number | null
  /** Whether the tokens may be low: an agent's report is unreadable, skipped lines, or has no tokens recorded. */
  readonly partial: boolean
  /** How many agents ran in the run. */
  readonly agents: number
  /** How many phases the run's record lists. */
  readonly phases: number
  /** The run's cost at API prices. */
  readonly cost: ReportCost
}

/**
 * A workflow run's stat grid items: its tokens over all its agents, how many
 * agents ran in it, its cost at API prices, and how many phases it has. A
 * run's tokens are its agents', so there is no separate own and below, and it
 * has no estimate of Claude Code's. A figure that may be low carries a "¹". A
 * run with no phases in its record leaves the phase count out.
 *
 * @example
 * <InspectorStatGrid>
 *   <WorkflowTotals tokens={30} partial={false} agents={2} phases={3} cost={{ usd: 5, partial: false }} />
 * </InspectorStatGrid>
 */
export function WorkflowTotals({
  tokens,
  partial,
  agents,
  phases,
  cost
}: WorkflowTotalsProps): React.JSX.Element {
  const { t } = useTranslation('sessionDetail')
  const { t: tSessions } = useTranslation('sessions')
  const tokenText = tokens === null ? null : tSessions('figure.compact', { value: tokens })
  const noTokensText = tSessions('emptyCell.tokensNotRecorded')
  const agentsText = t('inspector.workflow.agents', { count: agents })
  const phasesText = tSessions('stats.integer', { value: phases })
  const agentsLabel = tSessions('stats.agents')

  return (
    <>
      <StatRowItem
        label={t('inspector.stats.tokensAllAgents')}
        partialNote={partial ? t('partial.note') : undefined}
      >
        {tokenText ?? <EmptyCell spokenText={noTokensText} />}
      </StatRowItem>
      <StatRowItem label={agentsLabel}>{agentsText}</StatRowItem>
      <InspectorCostStat cost={cost} usageIncomplete={partial} />
      {phases > 0 && (
        <StatRowItem label={t('inspector.workflow.phasesHeading')}>{phasesText}</StatRowItem>
      )}
    </>
  )
}
