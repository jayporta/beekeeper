import { useTranslation } from 'react-i18next'
import { EmptyCell } from '@renderer/features/sessions/EmptyCell'
import { formatTokens } from '@renderer/features/sessions/formatTokens'
import { InspectorCostNote } from './InspectorCostNote'
import { InspectorMarker } from './InspectorMarker'
import styles from './InspectorTotals.module.css'
import type { ReportCost } from './reportCost'

/** Props for {@link WorkflowTotals}. */
interface WorkflowTotalsProps {
  /** The run's tokens: its agents' added up, or `null` when none has any recorded. */
  readonly tokens: number | null
  /** Whether the tokens may be low: an agent's report is unreadable, skipped lines, or has no tokens recorded. */
  readonly partial: boolean
  /** How many agents ran in the run. */
  readonly agents: number
  /** The run's cost at API prices. */
  readonly cost: ReportCost
}

/**
 * A workflow run's totals: its tokens in large type, how many agents ran in
 * it, then its cost at API prices. A run's tokens are its agents', so there is
 * no separate own and below. A figure that may be low carries a "¹".
 *
 * @example
 * <WorkflowTotals tokens={30} partial={false} agents={2} cost={{ usd: 5, partial: false }} />
 */
export function WorkflowTotals({
  tokens,
  partial,
  agents,
  cost
}: WorkflowTotalsProps): React.JSX.Element {
  const { t } = useTranslation('sessionDetail')
  const { t: tSessions } = useTranslation('sessions')
  const noTokensText = tSessions('emptyCell.tokensNotRecorded')

  return (
    <div className={styles.totals}>
      <p className={styles.figure}>
        {formatTokens(tokens, tSessions) ?? <EmptyCell spokenText={noTokensText} />}
        {partial && <InspectorMarker />}
      </p>
      <p className={styles.note}>{t('inspector.workflow.agents', { count: agents })}</p>
      <InspectorCostNote cost={cost} usageIncomplete={partial} />
    </div>
  )
}
