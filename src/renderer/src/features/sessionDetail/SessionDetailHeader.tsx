import { useTranslation } from 'react-i18next'
import { MAIN_HEADING_ID } from '@renderer/components/mainHeading'
import { MutedText } from '@renderer/components/MutedText'
import { PageTitle } from '@renderer/components/PageTitle'
import { PartialFootnote } from '@renderer/features/sessions/PartialFootnote'
import { SeparatedText } from '@renderer/features/sessions/SeparatedText'
import type { SessionDetailDto } from '../../../../shared/ipc/sessionDetailDto'
import type { SessionLabel } from '../../../../shared/sessions/sessionLabel'
import type { SessionRow } from '../../../../shared/sessions/sessionRow'
import styles from './SessionDetailHeader.module.css'
import { sessionMetaLine } from './sessionMetaLine'
import { SessionStats } from './SessionStats'
import { sessionStats } from './sessionStatFigures'

/** Props for {@link SessionDetailHeader}. */
interface SessionDetailHeaderProps {
  /** How the session is named, from `sessionDetailLabel`. */
  readonly label: SessionLabel
  /** The session's row in its folder's sessions list, or `null` when the list doesn't hold it. */
  readonly row: SessionRow | null
  /** Whether the session is an archived copy, which the header says. */
  readonly archived: boolean
  /**
   * Whether only the session's summary was archived, which the header says
   * instead, and leaves to the message under it to announce. Meaningful only
   * when `archived` is set.
   * @defaultValue false
   */
  readonly summaryOnly?: boolean
  /** The session's loaded detail, which the cache hit is read from, or `null` when there is none. */
  readonly detail: SessionDetailDto | null
}

/**
 * The session detail's header, which the header card holds under the
 * breadcrumb: the session's name as the page heading, a line of its start,
 * team and agents, and a stat row of its tokens, cost, cache hit, duration,
 * agents and tool errors. A partial figure gets a marker, and a footnote under
 * the row says why. A session the list doesn't hold is named by a placeholder
 * and its short id, with no line or stat row. An archived session says its
 * transcript was removed and the copy shown is beekeeper's. The sentence is
 * announced by a status region that is always mounted and empty until then,
 * and shown by text hidden from assistive technology so it isn't read twice.
 * When only the summary was archived, the sentence says so and is plain
 * readable text, and the status region stays empty, since the message under
 * the header is the one announcement.
 *
 * @example
 * <SessionDetailHeader label={label} row={row} archived={false} detail={detail} />
 */
export function SessionDetailHeader({
  label,
  row,
  archived,
  summaryOnly = false,
  detail
}: SessionDetailHeaderProps): React.JSX.Element {
  const { t } = useTranslation('sessionDetail')
  const { t: tSessions } = useTranslation('sessions')

  const metaLine = row === null ? [] : sessionMetaLine(row, tSessions)
  const stats = row === null ? null : sessionStats(row, detail)

  return (
    <>
      <div className={styles.heading}>
        <PageTitle id={MAIN_HEADING_ID}>
          <bdi>{label.text}</bdi>
        </PageTitle>
        {label.idHint !== null && <MutedText wrapAnywhere>{label.idHint}</MutedText>}
        {metaLine.length > 0 && (
          <MutedText wrapAnywhere>
            <bdi>
              <SeparatedText parts={metaLine} />
            </bdi>
          </MutedText>
        )}
      </div>
      {/* Mounted before the session turns archived, so filling it is announced. */}
      <p role="status" className="visuallyHidden">
        {archived && !summaryOnly ? t('archived') : ''}
      </p>
      {archived && !summaryOnly && <MutedText decorative>{t('archived')}</MutedText>}
      {archived && summaryOnly && <MutedText>{t('archivedSummaryOnly')}</MutedText>}
      {row !== null && stats !== null && (
        <SessionStats stats={stats} hasTeammates={row.teammates.length > 0} />
      )}
      <PartialFootnote
        reasons={stats?.reasons ?? new Set()}
        overrides={{
          unreadableLines: t('partial.unreadableLines'),
          missingTeammates: t('partial.missingTeammates'),
          incompleteSignals: t('partial.incompleteSignals')
        }}
      />
    </>
  )
}
