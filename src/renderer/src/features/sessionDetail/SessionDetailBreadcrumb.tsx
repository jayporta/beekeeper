import { useTranslation } from 'react-i18next'
import type { SessionRefDto } from '../../../../shared/ipc/sessionRefDto'
import { Breadcrumb, type BreadcrumbSegment } from '@renderer/features/navigation/Breadcrumb'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { projectTitle } from '@renderer/features/projects/projectTitle'
import { useSelectedProject } from '@renderer/features/projects/state/useSelectedProject'

/** Props for {@link SessionDetailBreadcrumb}. */
interface SessionDetailBreadcrumbProps {
  /** The viewed session's name, the current page. It may come from a transcript. */
  readonly title: string
  /** The lead of a teammate's own session, linked from the trail, or `null` for any other session. */
  readonly lead: SessionRefDto | null
}

/**
 * The session detail's breadcrumb, `project / Sessions / title`, which every
 * state of the view shows so there is always a way back. The project is text,
 * since Sessions is the step that goes to its sessions list. A teammate's own
 * session also links to its lead.
 *
 * @example
 * <SessionDetailBreadcrumb title="Refactor parser" lead={null} />
 */
export function SessionDetailBreadcrumb({
  title,
  lead
}: SessionDetailBreadcrumbProps): React.JSX.Element {
  const { t } = useTranslation(['sessionDetail', 'navigation'])
  const project = useSelectedProject()
  const showSessions = useNavigationStore((state) => state.showSessions)
  const showSession = useNavigationStore((state) => state.showSession)

  const segments: BreadcrumbSegment[] = [
    ...(project === null ? [] : [{ label: projectTitle(project) }]),
    { label: t('navigation:breadcrumb.sessions'), onSelect: showSessions },
    ...(lead === null
      ? []
      : [{ label: t('breadcrumb.leadSession'), onSelect: () => showSession(lead) }]),
    { label: title }
  ]

  return <Breadcrumb segments={segments} />
}
