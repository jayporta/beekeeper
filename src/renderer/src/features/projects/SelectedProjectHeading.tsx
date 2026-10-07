import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { MutedText } from '@renderer/components/MutedText'
import { TitleRow } from '@renderer/components/TitleRow'
import { Breadcrumb, type BreadcrumbSegment } from '@renderer/features/navigation/Breadcrumb'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { parentProject } from './parentProject'
import { projectLabel } from './projectLabel'
import { projectTitle } from './projectTitle'
import styles from './SelectedProjectHeading.module.css'
import { useSelectedProject } from './state/useSelectedProject'
import { useSelectedProjectStore } from './state/useSelectedProjectStore'
import { useProjects } from './useProjects'

/** Props for {@link SelectedProjectHeading}. */
interface SelectedProjectHeadingProps {
  /** An id for the `h1`, so a list can be labelled by it. */
  readonly headingId?: string
  /** Controls shown on the right of the title row, such as search and refresh. Kept outside the `h1`, so they don't change its name. */
  readonly actions?: React.ReactNode
}

/**
 * The sessions view's header: a breadcrumb from "All projects" to the
 * selected project, the project's name as the heading, its folder name exactly
 * as on disk beneath it, and optional controls on the right. A worktree
 * folder is named by its worktree, with its parent project as a step in the
 * breadcrumb. With no project selected it shows only a fixed heading.
 *
 * @example
 * <SelectedProjectHeading actions={<RefreshSessionsButton key={dirName} dirName={dirName} />} />
 */
export function SelectedProjectHeading({
  headingId,
  actions
}: SelectedProjectHeadingProps): React.JSX.Element {
  const { t } = useTranslation(['projects', 'overview'])
  const { data: projects } = useProjects()
  const project = useSelectedProject()
  const select = useSelectedProjectStore((state) => state.select)
  const showOverview = useNavigationStore((state) => state.showOverview)
  const showSessions = useNavigationStore((state) => state.showSessions)

  const parent = useMemo(
    () => (project === null || projects === undefined ? null : parentProject(projects, project)),
    [projects, project]
  )
  const title = project === null ? t('heading') : projectTitle(project)
  const segments: BreadcrumbSegment[] = [
    { label: t('overview:heading'), onSelect: showOverview },
    ...(parent === null
      ? []
      : [
          {
            label: projectLabel(parent),
            onSelect: () => {
              select(parent.dirName)
              showSessions()
            }
          }
        ]),
    { label: title }
  ]

  return (
    <header className={styles.header}>
      {project !== null && <Breadcrumb segments={segments} />}
      <TitleRow>
        <div className={styles.heading}>
          <h1 id={headingId} className={styles.title}>
            {title}
          </h1>
          {project !== null && <MutedText wrapAnywhere>{project.dirName}</MutedText>}
        </div>
        <div className={styles.actions}>{actions}</div>
      </TitleRow>
    </header>
  )
}
