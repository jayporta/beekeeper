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
import { ProjectDot } from './ProjectDot'
import { ProjectGroupRows } from './ProjectGroupRows'
import { ProjectLine } from './ProjectLine'
import styles from './ProjectList.module.css'
import { projectColorSlot } from './projectColorSlot'
import { ProjectRow } from './ProjectRow'
import { useSelectedProjectDirName } from './state/useSelectedProjectDirName'
import { useSelectedProjectStore } from './state/useSelectedProjectStore'

/**
 * The sidebar's project navigation: an "All projects" row, then a row for
 * each top-level project, each with its color, its token total for the chosen
 * window, and a toggle for its worktrees. Pressing a project selects it and
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
  const { projects: data, items, overall, folderTotals } = useProjectGroupTotals()
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
    showSessions(dirName)
  }
  const chooseOverview = (): void => {
    dismissFirstRun()
    showOverview()
  }

  return (
    <nav className={styles.list} aria-labelledby={labelId}>
      <CapsText id={labelId} className={styles.label}>
        {t('list.label')}
      </CapsText>
      <ul className={styles.rows}>
        <li>
          <ProjectLine>
            <ProjectRow
              dot={<ProjectDot variant="all" />}
              label={t('list.all')}
              meta={<SidebarTotal totals={overall} />}
              current={isOverview}
              onSelect={chooseOverview}
            />
          </ProjectLine>
        </li>
        {items.map((item, index) => (
          <ProjectGroupRows
            key={item.group.project.dirName}
            item={item}
            folderTotals={folderTotals}
            slot={projectColorSlot(index)}
            current={isOverview ? null : selected}
            onChoose={choose}
          />
        ))}
      </ul>
      {/* The whole's total is low whenever a project's is, so it decides for every row. */}
      {showsMayBeLow(overall) && <SidebarMayBeLowNote />}
    </nav>
  )
}
