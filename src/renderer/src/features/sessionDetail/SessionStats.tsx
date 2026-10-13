import { useTranslation } from 'react-i18next'
import { MutedText } from '@renderer/components/MutedText'
import { StatRow } from '@renderer/components/StatRow'
import { StatRowItem } from '@renderer/components/StatRowItem'
import { formatDuration } from '@renderer/features/sessions/formatDuration'
import { formatUsd } from '@renderer/i18n/formatUsd'
import type { SessionStats as Stats, StatFigure } from './sessionStatFigures'

/** Props for {@link SessionStats}. */
interface SessionStatsProps {
  /** The session's figures, from `sessionStats`. */
  readonly stats: Stats
  /** Whether the session has teammates, whose own transcripts the cache hit leaves out. */
  readonly hasTeammates: boolean
}

/**
 * The stat row of a session's header: tokens, cost at API prices, cache hit,
 * duration, agents, and tool errors, each beside its label. A figure that is
 * unknown is left out, and a partial one carries a marker that points at the
 * header's footnote. A session with teammates says under the row that the
 * cache hit covers the lead and its subagents, not the teammates.
 *
 * @example
 * <SessionStats stats={sessionStats(row, detail)} hasTeammates={false} />
 */
export function SessionStats({ stats, hasTeammates }: SessionStatsProps): React.JSX.Element {
  const { t } = useTranslation('sessionDetail')
  const { t: tSessions } = useTranslation('sessions')
  const note = t('partial.note')
  const noteOf = (figure: StatFigure | null): string | undefined =>
    figure?.partial === true ? note : undefined
  const tokens = stats.tokens && tSessions('figure.compact', { value: stats.tokens.value })
  const usd = formatUsd(stats.usd?.value ?? null, tSessions)
  const cacheHit =
    stats.cacheHit && tSessions('teammate.share', { value: Math.round(stats.cacheHit.value * 100) })
  const duration = formatDuration(stats.durationMs, tSessions)
  const agents = stats.agents && tSessions('stats.integer', { value: stats.agents.value })
  const toolErrors =
    stats.toolErrors && tSessions('stats.integer', { value: stats.toolErrors.value })
  const tokensLabel = tSessions('stats.tokens')
  const costLabel = tSessions('stats.cost')
  const agentsLabel = tSessions('stats.agents')

  return (
    <>
      <StatRow inline>
        {tokens !== null && (
          <StatRowItem label={tokensLabel} partialNote={noteOf(stats.tokens)}>
            {tokens}
          </StatRowItem>
        )}
        {usd !== null && (
          <StatRowItem label={costLabel} partialNote={noteOf(stats.usd)}>
            {usd}
          </StatRowItem>
        )}
        {cacheHit !== null && (
          <StatRowItem label={t('stats.cacheHit')} partialNote={noteOf(stats.cacheHit)}>
            {cacheHit}
          </StatRowItem>
        )}
        {duration !== null && <StatRowItem label={t('stats.duration')}>{duration}</StatRowItem>}
        {agents !== null && (
          <StatRowItem label={agentsLabel} partialNote={noteOf(stats.agents)}>
            {agents}
          </StatRowItem>
        )}
        {toolErrors !== null && (
          <StatRowItem label={t('stats.toolErrors')} partialNote={noteOf(stats.toolErrors)}>
            {toolErrors}
          </StatRowItem>
        )}
      </StatRow>
      {hasTeammates && <MutedText smaller>{t('stats.scope')}</MutedText>}
    </>
  )
}
