import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { SessionDetailDto } from '../../../../../shared/ipc/sessionDetailDto'
import { PartialMarker } from '@renderer/components/PartialMarker'
import { readableReports } from '../readableReports'
import { tokenClasses } from '../tokens/tokenClasses'
import { TokenClassBar } from '../tokens/TokenClassBar'
import { TokenClassRows } from '../tokens/TokenClassRows'
import { SummaryCard } from './SummaryCard'

/** Props for {@link BreakdownCard}. */
interface BreakdownCardProps {
  /** The viewed session's loaded detail. */
  readonly detail: SessionDetailDto
}

/**
 * The Breakdown card: the session's tokens by class, over its lead and the
 * subagents whose reports could be read, as a segmented bar and a list. When
 * the subagents folder or one of its reports couldn't be read, the caption
 * carries a partial marker.
 *
 * @example
 * <BreakdownCard detail={detail} />
 */
export function BreakdownCard({ detail }: BreakdownCardProps): React.JSX.Element {
  const { t } = useTranslation('sessionDetail')
  const { reports, complete } = useMemo(() => readableReports(detail), [detail])
  const classes = useMemo(() => tokenClasses(reports), [reports])

  return (
    <SummaryCard
      title={t('summary.breakdown.title')}
      caption={
        <>
          {t('summary.breakdown.caption')}
          {!complete && <PartialMarker note={t('summary.partialNote')} />}
        </>
      }
    >
      <TokenClassBar classes={classes} />
      <TokenClassRows classes={classes} />
    </SummaryCard>
  )
}
