import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { groupProjects } from './groupProjects'
import { hasProjectsToShow } from './hasProjectsToShow'
import { ProjectRow } from './ProjectRow'
import styles from './ProjectList.module.css'
import { projectTitle } from './projectTitle'
import { useSelectedProjectDirName } from './state/useSelectedProjectDirName'
import { useSelectedProjectStore } from './state/useSelectedProjectStore'
import { useProjects } from './useProjects'

/**
 * The sidebar's project navigation: an "All projects" row, then a row for
 * each top-level project. The worktrees of the project in effect, or of the
 * project a selected worktree belongs to, list beneath it. Pressing a project
 * selects it and shows its sessions. Renders nothing until there is a project
 * to show, the same condition under which `ProjectsGate` shows its children.
 *
 * @example
 * <ProjectList />
 */
export function ProjectList(): React.JSX.Element | null {
  const { t } = useTranslation('projects')
  const { data } = useProjects()
  const selected = useSelectedProjectDirName()
  const select = useSelectedProjectStore((state) => state.select)
  const isOverview = useNavigationStore((state) => state.view === 'overview')
  const showOverview = useNavigationStore((state) => state.showOverview)
  const showSessions = useNavigationStore((state) => state.showSessions)
  const labelId = useId()

  if (data === undefined || !hasProjectsToShow(data)) return null

  const choose = (dirName: string): void => {
    select(dirName)
    showSessions()
  }
  const isCurrent = (dirName: string): boolean => !isOverview && dirName === selected

  return (
    <nav className={styles.list} aria-labelledby={labelId}>
      <p id={labelId} className={styles.label}>
        {t('list.label')}
      </p>
      <ul className={styles.rows}>
        <ProjectRow label={t('list.all')} current={isOverview} onSelect={showOverview} />
        {groupProjects(data).flatMap(({ project, worktrees }) => {
          const isActiveGroup =
            !isOverview &&
            (project.dirName === selected || worktrees.some((w) => w.dirName === selected))
          return [
            <ProjectRow
              key={project.dirName}
              label={projectTitle(project)}
              detail={project.dirName}
              current={isCurrent(project.dirName)}
              onSelect={() => {
                choose(project.dirName)
              }}
            />,
            ...(isActiveGroup ? worktrees : []).map((worktree) => (
              <ProjectRow
                key={worktree.dirName}
                nested
                label={projectTitle(worktree)}
                detail={worktree.dirName}
                meta={t('list.worktree')}
                current={isCurrent(worktree.dirName)}
                onSelect={() => {
                  choose(worktree.dirName)
                }}
              />
            ))
          ]
        })}
      </ul>
    </nav>
  )
}
