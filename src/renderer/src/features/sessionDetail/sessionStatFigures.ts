import type { AgentReportDto } from '../../../../shared/ipc/agentDto'
import type { SessionDetailDto } from '../../../../shared/ipc/sessionDetailDto'
import { activitySpanMs } from '@renderer/features/sessions/activitySpanMs'
import { cardFigures } from '@renderer/features/sessions/cardFigures'
import { figureReasons, type PartialReason } from '@renderer/features/sessions/partialReasons'
import type { SessionRow } from '@renderer/features/sessions/sessionRow'
import { signalTotalsOf } from '@renderer/features/sessions/signalNotes'

/** One figure of the stat row, and whether it may leave something out. */
export interface StatFigure {
  /** The figure. */
  readonly value: number
  /** Whether something the figure counts could not be read, so it may be off. */
  readonly partial: boolean
}

/** The figures of a session's stat row. A figure that is unknown is `null`. */
export interface SessionStats {
  /** Tokens across every class: the team's total for a lead with a team. */
  readonly tokens: StatFigure | null
  /** Cost at API prices in US dollars: the team's total for a lead with a team. */
  readonly usd: StatFigure | null
  /** The share of input tokens served from the cache, from 0 to 1, over the lead and its subagents. */
  readonly cacheHit: StatFigure | null
  /** The span from the session's first to its last message, in milliseconds. */
  readonly durationMs: number | null
  /** How many agents ran: the session and each teammate, and each one's subagents. */
  readonly agents: StatFigure | null
  /** Tool errors: the team's total for a lead with a team. */
  readonly toolErrors: StatFigure | null
  /** Why a figure is partial, for the footnote that explains the marker. */
  readonly reasons: ReadonlySet<PartialReason>
}

/** The reports of the lead and every subagent that could be read, and whether one could not. */
function readableReports(detail: SessionDetailDto): {
  readonly reports: readonly AgentReportDto[]
  readonly complete: boolean
} {
  if (!detail.subagents.ok) return { reports: [detail.lead], complete: false }
  const reports = [detail.lead]
  let complete = true
  for (const { report } of detail.subagents.value) {
    if (report.ok) reports.push(report.value)
    else complete = false
  }
  return { reports, complete }
}

/** The cache hit of the lead and its subagents, or `null` when they read no input. */
function cacheHitOf(detail: SessionDetailDto): StatFigure | null {
  const { reports, complete } = readableReports(detail)
  let read = 0
  let total = 0
  for (const report of reports) {
    for (const { tokens } of report.tokenGroups) {
      read += tokens.cacheRead
      total += tokens.input + tokens.cacheRead + tokens.cacheWrite5m + tokens.cacheWrite1h
    }
  }
  return total === 0 ? null : { value: read / total, partial: !complete }
}

/** How many agents the session and its teammates ran, counted as the folder totals count them. */
function agentsOf(row: SessionRow): StatFigure {
  let value = 0
  let partial = false
  for (const { item } of [row, ...row.teammates]) {
    value += 1 + (item.subagentCount ?? 0)
    if (item.subagentCount === null) partial = true
  }
  return { value, partial }
}

/**
 * Works out the figures of a session's stat row.
 *
 * @param row - The session's row in its folder's list.
 * @param detail - The session's loaded detail, or `null` when there is none, as for a summary-only archive.
 * @returns The figures, with the reasons any of them is partial. A figure that can't be told is `null`.
 */
export function sessionStats(row: SessionRow, detail: SessionDetailDto | null): SessionStats {
  const { item } = row
  const { figures } = cardFigures(item)
  const reasons = new Set(figureReasons(row))
  const marked = reasons.size > 0
  const totals = signalTotalsOf(item)
  const cacheHit = detail === null ? null : cacheHitOf(detail)
  const tokens = figures?.tokens ?? null
  const usd = figures?.usd ?? null

  if (cacheHit?.partial === true) reasons.add('unreadableLines')
  if (totals?.partial === true) reasons.add('incompleteSignals')

  return {
    tokens: tokens === null ? null : { value: tokens, partial: marked },
    usd: usd === null ? null : { value: usd, partial: marked },
    cacheHit,
    durationMs: activitySpanMs(item.summary.ok ? item.summary.value.activity : null),
    agents: agentsOf(row),
    toolErrors: totals === null ? null : { value: totals.toolErrors, partial: totals.partial },
    reasons
  }
}
