import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { CapsText } from '@renderer/components/CapsText'
import { useFirstRunStore } from '@renderer/features/firstRun/state/useFirstRunStore'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { showsMayBeLow } from '@renderer/features/overview/showsMayBeLow'
import { SidebarMayBeLowNote } from '@renderer/features/overview/SidebarMayBeLowNote'
import { SidebarTotal } from '@renderer/features/overview/SidebarTotal'
import { useProjectGroupTotals } from '@renderer/features/overview/useProjectGroupTotals'
import { hasProjectsToShow } from './hasProjectsToShow'
import { ProjectRow } from './ProjectRow'
import styles from './ProjectList.module.css'
import { projectTitle } from './projectTitle'
import { useSelectedProjectDirName } from './state/useSelectedProjectDirName'
import { useSelectedProjectStore } from './state/useSelectedProjectStore'

/**
 * The sidebar's project navigation: an "All projects" row, then a row for
 * each top-level project, each with its token total for the chosen window.
 * The worktrees of the project in effect, or of the project a selected
 * worktree belongs to, list beneath it. Pressing a project selects it and
 * shows its sessions. Pressing any row also dismisses the first-run screen,
 * the same as its "Got it" button, since the sidebar is usable while it shows.
 * Renders nothing until there is a project to show, the
 * same condition under which `ProjectsGate` shows its children.
 *
 * @example
 * <ProjectList />
 */
export function ProjectList(): React.JSX.Element | null {
  const { t } = useTranslation('projects')
  const { projects: data, items: rows, overall } = useProjectGroupTotals()
  const selected = useSelectedProjectDirName()
  const select = useSelectedProjectStore((state) => state.select)
  const isOverview = useNavigationStore((state) => state.view === 'overview')
  const showOverview = useNavigationStore((state) => state.showOverview)
  const showSessions = useNavigationStore((state) => state.showSessions)
  const dismissFirstRun = useFirstRunStore((state) => state.dismiss)
  const labelId = useId()

  if (data === undefined || !hasProjectsToShow(data)) return null

  const choose = (dirName: string): void => {
    dismissFirstRun()
    select(dirName)
    showSessions()
  }
  const chooseOverview = (): void => {
    dismissFirstRun()
    showOverview()
  }
  const isCurrent = (dirName: string): boolean => !isOverview && dirName === selected

  return (
    <nav className={styles.list} aria-labelledby={labelId}>
      <CapsText id={labelId}>{t('list.label')}</CapsText>
      <ul className={styles.rows}>
        <ProjectRow
          label={t('list.all')}
          meta={<SidebarTotal totals={overall} />}
          current={isOverview}
          onSelect={chooseOverview}
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
