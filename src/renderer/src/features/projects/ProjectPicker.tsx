import { useId } from 'react'
import { groupProjects } from './groupProjects'
import styles from './ProjectPicker.module.css'
import { useSelectedProjectDirName } from './state/useSelectedProjectDirName'
import { useSelectedProjectStore } from './state/useSelectedProjectStore'
import { useProjects } from './useProjects'

/**
 * A labeled select for choosing which project's sessions to show. Worktree
 * folders are listed in a group under their parent project. Renders nothing
 * until projects are loaded and there is at least one.
 *
 * @example
 * <ProjectPicker />
 */
export function ProjectPicker(): React.JSX.Element | null {
  const { data } = useProjects()
  const selected = useSelectedProjectDirName()
  const select = useSelectedProjectStore((state) => state.select)
  const selectId = useId()

  if (data === undefined || selected === null) return null

  return (
    <div className={styles.picker}>
      <label htmlFor={selectId} className={styles.label}>
        Project
      </label>
      <select
        id={selectId}
        className={styles.select}
        value={selected}
        onChange={(event) => {
          select(event.target.value)
        }}
      >
        {groupProjects(data).flatMap(({ project, worktrees }) => [
          <option key={project.dirName} value={project.dirName}>
            {project.dirName}
          </option>,
          ...(worktrees.length === 0
            ? []
            : [
                <optgroup
                  key={`${project.dirName}/worktrees`}
                  label={`${project.dirName} worktrees`}
                >
                  {worktrees.map((worktree) => (
                    <option key={worktree.dirName} value={worktree.dirName}>
                      {worktree.dirName}
                    </option>
                  ))}
                </optgroup>
              ])
        ])}
      </select>
      <p className={styles.note}>Worktree folders are grouped under their project.</p>
    </div>
  )
}
