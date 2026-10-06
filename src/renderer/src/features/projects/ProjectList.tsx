import { useId, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { overviewTotals, projectTotalsOf } from '@renderer/features/overview/projectTotalsOf'
import { showsMayBeLow } from '@renderer/features/overview/showsMayBeLow'
import { SidebarMayBeLowNote } from '@renderer/features/overview/SidebarMayBeLowNote'
import { SidebarTotal } from '@renderer/features/overview/SidebarTotal'
import { useProjectTotals } from '@renderer/features/overview/useProjectTotals'
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
 * each top-level project, each with its token total for the chosen window.
 * The worktrees of the project in effect, or of the project a selected
 * worktree belongs to, list beneath it. Pressing a project selects it and
 * shows its sessions. Renders nothing until there is a project to show, the
 * same condition under which `ProjectsGate` shows its children.
 *
 * @example
 * <ProjectList />
 */
export function ProjectList(): React.JSX.Element | null {
  const { t } = useTranslation('projects')
  const { data } = useProjects()
  const { byFolder } = useProjectTotals()
  const selected = useSelectedProjectDirName()
  const select = useSelectedProjectStore((state) => state.select)
  const isOverview = useNavigationStore((state) => state.view === 'overview')
  const showOverview = useNavigationStore((state) => state.showOverview)
  const showSessions = useNavigationStore((state) => state.showSessions)
  const labelId = useId()

  const groups = useMemo(() => groupProjects(data ?? []), [data])
  const rows = useMemo(
    () => groups.map((group) => ({ group, totals: projectTotalsOf(group, byFolder) })),
    [groups, byFolder]
  )
  const overall = useMemo(() => overviewTotals(groups, byFolder), [groups, byFolder])

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
        <ProjectRow
          label={t('list.all')}
          meta={<SidebarTotal totals={overall} />}
          current={isOverview}
          onSelect={showOverview}
        />
        {rows.flatMap(({ group, totals }) => {
          const { project, worktrees } = group
          const isActiveGroup =
            !isOverview &&
            (project.dirName === selected || worktrees.some((w) => w.dirName === selected))
          return [
            <ProjectRow
              key={project.dirName}
              label={projectTitle(project)}
              detail={project.dirName}
              meta={<SidebarTotal totals={totals} />}
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
      {/* The whole's total is low whenever a project's is, so it decides for every row. */}
      {showsMayBeLow(overall) && <SidebarMayBeLowNote />}
    </nav>
  )
}
