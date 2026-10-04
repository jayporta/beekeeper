import { useTranslation } from 'react-i18next'
import type { SessionRefDto } from '../../../../shared/ipc/sessionRefDto'
import { MAIN_HEADING_ID } from '@renderer/components/mainHeading'
import { Breadcrumb, type BreadcrumbSegment } from '@renderer/features/navigation/Breadcrumb'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { projectTitle } from '@renderer/features/projects/projectTitle'
import { useSelectedProject } from '@renderer/features/projects/state/useSelectedProject'
import { PartialFootnote } from '@renderer/features/sessions/PartialFootnote'
import { PartialMarker } from '@renderer/features/sessions/PartialMarker'
import { partialReasons } from '@renderer/features/sessions/partialReasons'
import { SeparatedText } from '@renderer/features/sessions/SeparatedText'
import { shortId } from '@renderer/features/sessions/sessionLabel'
import type { SessionRow } from '@renderer/features/sessions/sessionRow'
import styles from './SessionDetailHeader.module.css'
import { sessionMetaLine } from './sessionMetaLine'

/** Props for {@link SessionDetailHeader}. */
interface SessionDetailHeaderProps {
  /** The viewed session. */
  readonly sessionRef: SessionRefDto
  /** The session's row in its folder's sessions list, or `null` when the list doesn't hold it. */
  readonly row: SessionRow | null
}

/**
 * The session detail's header: a breadcrumb from the project through Sessions
 * to the session, the session's title as the page heading, and a line of its
 * start, duration, team, agents, tokens and cost. A teammate's own session
 * also links to its lead. A session the list doesn't hold is titled by a
 * placeholder and its short id, with no line.
 *
 * @example
 * <SessionDetailHeader sessionRef={ref} row={row} />
 */
export function SessionDetailHeader({
  sessionRef,
  row
}: SessionDetailHeaderProps): React.JSX.Element {
  const { t } = useTranslation(['sessionDetail', 'navigation'])
  const { t: tSessions } = useTranslation('sessions')
  const project = useSelectedProject()
  const showSessions = useNavigationStore((state) => state.showSessions)
  const showSession = useNavigationStore((state) => state.showSession)

  const label = row?.label ?? {
    text: tSessions('label.untitled'),
    idHint: shortId(sessionRef.sessionId)
  }
  const lead = row?.item.team?.kind === 'teammate' ? row.item.team.lead : null
  const metaLine = row === null ? [] : sessionMetaLine(row, tSessions)
  const reasons = row === null ? null : partialReasons(row)
  const segments: BreadcrumbSegment[] = [
    ...(project === null ? [] : [{ label: projectTitle(project), onSelect: showSessions }]),
    { label: t('navigation:breadcrumb.sessions'), onSelect: showSessions },
    ...(lead === null
      ? []
      : [{ label: t('breadcrumb.leadSession'), onSelect: () => showSession(lead) }]),
    { label: label.text }
  ]

  return (
    <header className={styles.header}>
      <Breadcrumb segments={segments} />
      <h1 id={MAIN_HEADING_ID} className={styles.title}>
        <bdi>{label.text}</bdi>
      </h1>
      {label.idHint !== null && <p className={styles.muted}>{label.idHint}</p>}
      {metaLine.length > 0 && (
        <p className={styles.muted}>
          <bdi>
            <SeparatedText parts={metaLine} />
          </bdi>
          {reasons !== null && reasons.size > 0 && <PartialMarker />}
        </p>
      )}
      {reasons !== null && <PartialFootnote reasons={reasons} />}
    </header>
  )
}
