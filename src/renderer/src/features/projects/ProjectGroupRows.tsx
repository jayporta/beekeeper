import { useId } from 'react'
import { SidebarTotal } from '@renderer/features/overview/SidebarTotal'
import type { AggregateTotals } from '@renderer/features/overview/sumTotals'
import type { ProjectGroupItem } from '@renderer/features/overview/useProjectGroupTotals'
import { ProjectDot } from './ProjectDot'
import styles from './ProjectGroupRows.module.css'
import { ProjectLine } from './ProjectLine'
import type { ProjectColorSlot } from './projectColorSlot'
import { ProjectRow } from './ProjectRow'
import { projectTitle } from './projectTitle'
import { isGroupExpanded } from './state/isGroupExpanded'
import { useExpandedProjectsStore } from './state/useExpandedProjectsStore'
import { WorktreeToggle } from './WorktreeToggle'

/** Props for {@link ProjectGroupRows}. */
interface ProjectGroupRowsProps {
  /** The project, its worktrees, and their totals. */
  readonly item: ProjectGroupItem
  /** The project's color slot, which its worktrees share. */
  readonly slot: ProjectColorSlot
  /** Adds up one folder on its own, for a worktree row's figure. */
  readonly folderTotals: (dirName: string) => AggregateTotals
  /** The folder name of the current page's project, or `null` while the overview shows. */
  readonly current: string | null
  /** Called with a folder name when its row is pressed. */
  readonly onChoose: (dirName: string) => void
}

/**
 * A top-level project's list item: its row, a toggle for its worktrees when it
 * has any, and the worktree rows. The worktrees show when the person opened
 * them, or by default while the group holds the current page. A closed group
 * is hidden, so its rows leave the tab order.
 *
 * @example
 * <ProjectGroupRows item={item} slot={1} current={selected} onChoose={choose} />
 */
export function ProjectGroupRows({
  item,
  folderTotals,
  slot,
  current,
  onChoose
}: ProjectGroupRowsProps): React.JSX.Element {
  const { group, totals } = item
  const { project, worktrees } = group
  const listId = useId()
  const chosen = useExpandedProjectsStore((state) => state.toggled[project.dirName])
  const setExpanded = useExpandedProjectsStore((state) => state.setExpanded)
  const holdsWorktree =
    current !== null && worktrees.some((worktree) => worktree.dirName === current)
  const expanded = isGroupExpanded(chosen, current === project.dirName || holdsWorktree)

  return (
    <li>
      <ProjectLine
        toggle={
          worktrees.length === 0 ? undefined : (
            <WorktreeToggle
              expanded={expanded}
              controls={listId}
              project={projectTitle(project)}
              onToggle={(next) => {
                setExpanded(project.dirName, next)
              }}
            />
          )
        }
      >
        <ProjectRow
          dot={<ProjectDot variant="solid" slot={slot} />}
          label={projectTitle(project)}
          detail={project.dirName}
          meta={<SidebarTotal totals={totals} />}
          current={current === project.dirName}
          holdsCurrent={holdsWorktree && !expanded}
          onSelect={() => {
            onChoose(project.dirName)
          }}
        />
      </ProjectLine>
      {worktrees.length > 0 && (
        <ul id={listId} className={styles.worktrees} hidden={!expanded}>
          {worktrees.map((worktree) => {
            return (
              <li key={worktree.dirName}>
                <ProjectLine>
                  <ProjectRow
                    nested
                    dot={<ProjectDot variant="ring" slot={slot} />}
                    label={projectTitle(worktree)}
                    detail={worktree.dirName}
                    meta={
                      expanded ? (
                        <SidebarTotal totals={folderTotals(worktree.dirName)} />
                      ) : undefined
                    }
                    current={current === worktree.dirName}
                    onSelect={() => {
                      onChoose(worktree.dirName)
                    }}
                  />
                </ProjectLine>
              </li>
            )
          })}
        </ul>
      )}
    </li>
  )
}
