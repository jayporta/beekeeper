import { useTranslation } from 'react-i18next'
import { StatRowItem } from '@renderer/components/StatRowItem'
import { EmptyCell } from '@renderer/features/sessions/EmptyCell'
import { useOtelReceiver } from '@renderer/features/telemetry/useOtelReceiver'
import { useReportedCost } from '@renderer/features/telemetry/useReportedCost'
import { formatUsd } from '@renderer/i18n/formatUsd'

/** Props for {@link ReportedCostStat}. */
interface ReportedCostStatProps {
  /** The session the inspected agent belongs to. */
  readonly sessionId: string
  /** The inspected subagent's id, or `null` for the session's own agent. */
  readonly agentId: string | null
}

/**
 * The stat grid's item for Claude Code's own cost estimate for the inspected
 * agent, from the telemetry it reports, as a cross-check beside beekeeper's.
 * The session's own agent gets the whole session's reported cost, which is
 * authoritative, and a subagent gets its share only when Claude Code reported
 * one under exactly its id. While the first read is pending it shows an empty cell. It says the estimate is not available while the
 * receiver is off or has stopped, when nothing was reported, or when the agent
 * has no share, and says so differently when the figures can't be read. A
 * read that fails after one succeeded leaves the last figure showing. The
 * figures are asked for only while the receiver is listening.
 *
 * @example
 * <ReportedCostStat sessionId={ref.sessionId} agentId={null} />
 */
export function ReportedCostStat({ sessionId, agentId }: ReportedCostStatProps): React.JSX.Element {
  const { t } = useTranslation('sessionDetail')
  const { t: tSessions } = useTranslation('sessions')
  const { data, isError } = useReportedCost(sessionId)
  // A query that is no longer enabled keeps its last data, so the receiver decides what shows.
  const { data: receiver } = useOtelReceiver()

  const costUsd =
    data === undefined || data === null
      ? null
      : agentId === null
        ? data.costUsd
        : (data.byAgent.find((agent) => agent.agentId === agentId)?.costUsd ?? null)
  const listening = receiver?.status === 'listening'
  const figure = listening && costUsd !== null ? formatUsd(costUsd, tSessions) : null
  const unreadable = listening && data === undefined && isError
  // The first read, including the wait before a retry, hasn't answered yet.
  const pending = listening && data === undefined && !isError
  const label =
    agentId === null ? t('inspector.reportedCost.labelSession') : t('inspector.reportedCost.label')

  return (
    <StatRowItem label={label}>
      {pending ? (
        <EmptyCell />
      ) : unreadable ? (
        t('inspector.reportedCost.unavailable')
      ) : (
        (figure ?? t('inspector.reportedCost.notAvailable'))
      )}
    </StatRowItem>
  )
}
