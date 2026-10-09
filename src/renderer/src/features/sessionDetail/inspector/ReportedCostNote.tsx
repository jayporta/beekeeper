import { useTranslation } from 'react-i18next'
import { MutedText } from '@renderer/components/MutedText'
import { useOtelReceiver } from '@renderer/features/telemetry/useOtelReceiver'
import { useReportedCost } from '@renderer/features/telemetry/useReportedCost'
import { formatUsd } from '@renderer/i18n/formatUsd'

/** Props for {@link ReportedCostNote}. */
interface ReportedCostNoteProps {
  /** The session the inspected agent belongs to. */
  readonly sessionId: string
  /** The inspected subagent's id, or `null` for the session's own agent. */
  readonly agentId: string | null
}

/**
 * Claude Code's own cost estimate for the inspected agent, from the telemetry
 * it reports, as a cross-check beside beekeeper's. The session's own agent
 * gets the whole session's reported cost, which is authoritative, and a
 * subagent gets its share only when Claude Code reported one under exactly its
 * id. It shows nothing while the receiver is off or when nothing was reported,
 * and says so when the figures can't be read. A read that fails after one
 * succeeded leaves the last figure showing.
 *
 * @example
 * <ReportedCostNote sessionId={ref.sessionId} agentId={null} />
 */
export function ReportedCostNote({
  sessionId,
  agentId
}: ReportedCostNoteProps): React.JSX.Element | null {
  const { t } = useTranslation('sessionDetail')
  const { data, isError } = useReportedCost(sessionId)
  // A query that is no longer enabled keeps its last data, so the receiver decides what shows.
  const { data: receiver } = useOtelReceiver()

  if (receiver?.status !== 'listening') return null
  if (data === undefined && isError) {
    return <MutedText>{t('inspector.reportedCost.unavailable')}</MutedText>
  }
  if (data === undefined || data === null) return null
  if (agentId === null) {
    return (
      <MutedText>
        {t('inspector.reportedCost.session', { value: formatUsd(data.costUsd, t) })}
      </MutedText>
    )
  }
  const share = data.byAgent.find((agent) => agent.agentId === agentId)
  if (share === undefined) return null
  return (
    <MutedText>
      {t('inspector.reportedCost.agent', { value: formatUsd(share.costUsd, t) })}
    </MutedText>
  )
}
