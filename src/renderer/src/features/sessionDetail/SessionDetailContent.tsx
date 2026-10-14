import { useTranslation } from 'react-i18next'
import type { SessionRefDto } from '../../../../shared/ipc/sessionRefDto'
import { IpcCallError } from '@renderer/ipc/ipcCallError'
import { SessionDetailBody } from './SessionDetailBody'
import { SessionDetailBreadcrumb } from './SessionDetailBreadcrumb'
import { sessionDetailLabel } from './sessionDetailLabel'
import { SessionDetailHeader } from './SessionDetailHeader'
import { SessionDetailHeaderCard } from './SessionDetailHeaderCard'
import { SessionDetailStatus } from './SessionDetailStatus'
import { useAnnounceLoaded } from './useAnnounceLoaded'
import { useSessionDetail } from './useSessionDetail'
import { useSessionRow } from './useSessionRow'

/** Props for {@link SessionDetailContent}. */
interface SessionDetailContentProps {
  /** The session to show. */
  readonly sessionRef: SessionRefDto
  /** The folder whose sessions list holds the session's title and usage: the selected project's. */
  readonly dirName: string
}

/**
 * One session's detail: its header card, which holds the breadcrumb, then
 * its summary cards, agent graph and inspector once its detail has loaded,
 * otherwise the loading or failure message under the breadcrumb. Loaded data
 * wins over a failed background refresh, so a session on screen stays on
 * screen. A session reported not found waits for the folder's list to settle
 * first, since the folder itself may be gone. Once it has, an
 * archived row whose detail wasn't archived keeps its header and gets a
 * summary-only note instead of the not-found message, unless the folder is gone.
 * That also covers a project that isn't listed, so a stale archived row can reach it.
 * A load that was on screen is announced once, by a status region that is
 * always mounted and empty until then.
 *
 * @example
 * <SessionDetailContent sessionRef={ref} dirName="-Users-me-repo" />
 */
export function SessionDetailContent({
  sessionRef,
  dirName
}: SessionDetailContentProps): React.JSX.Element {
  const { t } = useTranslation('sessionDetail')
  const { data, error, errorUpdatedAt, refetch } = useSessionDetail(sessionRef)
  const { row, listPending, folderGone } = useSessionRow(sessionRef, dirName)
  const announceLoaded = useAnnounceLoaded(data !== undefined, !listPending)

  // The folder's list keeps its last data when the folder goes, so a gone folder never counts.
  const summaryOnly =
    IpcCallError.codeOf(error) === 'not-found' &&
    !listPending &&
    !folderGone &&
    row?.item.archived === true

  const label = sessionDetailLabel(row, sessionRef, t)
  const lead = row?.item.team?.kind === 'teammate' ? row.item.team.lead : null

  const showHeader = data !== undefined || summaryOnly

  return (
    <>
      <SessionDetailHeaderCard
        breadcrumb={<SessionDetailBreadcrumb title={label.text} lead={lead} />}
      >
        {showHeader && (
          <SessionDetailHeader
            label={label}
            row={row}
            archived={data === undefined || data.archived}
            summaryOnly={data === undefined}
            detail={data ?? null}
          />
        )}
      </SessionDetailHeaderCard>
      {data === undefined ? (
        <SessionDetailStatus
          error={error}
          errorUpdatedAt={errorUpdatedAt}
          holdNotFound={listPending}
          summaryOnly={summaryOnly}
          onRetry={() => {
            void refetch()
          }}
        />
      ) : (
        <SessionDetailBody detail={data} sessionRef={sessionRef} row={row} />
      )}
      <p role="status" className="visuallyHidden">
        {announceLoaded ? t('loaded', { title: label.text }) : ''}
      </p>
    </>
  )
}
