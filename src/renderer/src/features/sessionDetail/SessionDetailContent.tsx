import type { SessionRefDto } from '../../../../shared/ipc/sessionRefDto'
import { SessionDetailHeader } from './SessionDetailHeader'
import { SessionDetailStatus } from './SessionDetailStatus'
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
 * One session's detail: its header once its detail has loaded, otherwise the
 * loading or failure message. Loaded data wins over a failed background
 * refresh, so a session on screen stays on screen.
 *
 * @example
 * <SessionDetailContent sessionRef={ref} dirName="-Users-me-repo" />
 */
export function SessionDetailContent({
  sessionRef,
  dirName
}: SessionDetailContentProps): React.JSX.Element {
  const { data, error, refetch } = useSessionDetail(sessionRef)
  const row = useSessionRow(sessionRef, dirName)

  if (data === undefined) {
    return (
      <SessionDetailStatus
        error={error}
        onRetry={() => {
          void refetch()
        }}
      />
    )
  }
  return <SessionDetailHeader sessionRef={sessionRef} row={row} />
}
