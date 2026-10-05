import { useTranslation } from 'react-i18next'
import type { SessionRefDto } from '../../../../shared/ipc/sessionRefDto'
import { SessionDetailBody } from './SessionDetailBody'
import { SessionDetailBreadcrumb } from './SessionDetailBreadcrumb'
import { sessionDetailLabel } from './sessionDetailLabel'
import { SessionDetailHeader } from './SessionDetailHeader'
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
 * One session's detail: the breadcrumb, then its header, agent graph, and
 * inspector once its detail has loaded, otherwise the loading or failure
 * message. Loaded data wins over a failed background refresh, so a session on
 * screen stays on screen. A session reported not found waits for the folder's
 * list to settle first, since the folder itself may be gone. A load that was on
 * screen is announced once, by a status region that is always mounted and
 * empty until then.
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
  const { row, listPending } = useSessionRow(sessionRef, dirName)
  const announceLoaded = useAnnounceLoaded(data !== undefined, !listPending)

  const label = sessionDetailLabel(row, sessionRef, t)
  const lead = row?.item.team?.kind === 'teammate' ? row.item.team.lead : null

  return (
    <>
      <SessionDetailBreadcrumb title={label.text} lead={lead} />
      {data === undefined ? (
        <SessionDetailStatus
          error={error}
          errorUpdatedAt={errorUpdatedAt}
          holdNotFound={listPending}
          onRetry={() => {
            void refetch()
          }}
        />
      ) : (
        <>
          <SessionDetailHeader label={label} row={row} />
          <SessionDetailBody detail={data} sessionRef={sessionRef} row={row} />
        </>
      )}
      <p role="status" className="visuallyHidden">
        {announceLoaded ? t('loaded', { title: label.text }) : ''}
      </p>
    </>
  )
}
