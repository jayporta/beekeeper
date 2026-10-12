import { useTranslation } from 'react-i18next'
import styles from './WorktreeToggle.module.css'

/** Props for {@link WorktreeToggle}. */
interface WorktreeToggleProps {
  /** Whether the project's worktrees show. */
  readonly expanded: boolean
  /** The id of the list of worktrees the button opens and closes. */
  readonly controls: string
  /** The project's name, which names the button. It may come from a transcript, so it renders as plain text. */
  readonly project: string
  /** Called with the state the person asks for. */
  readonly onToggle: (expanded: boolean) => void
}

/**
 * The chevron before a project row that shows or hides its worktrees. It only
 * toggles: it doesn't select the project.
 *
 * @example
 * <WorktreeToggle expanded controls={listId} project="acme-web" onToggle={setExpanded} />
 */
export function WorktreeToggle({
  expanded,
  controls,
  project,
  onToggle
}: WorktreeToggleProps): React.JSX.Element {
  const { t } = useTranslation('projects')

  return (
    <button
      type="button"
      className={styles.toggle}
      aria-expanded={expanded}
      aria-controls={controls}
      aria-label={t('list.worktreesOf', { project })}
      onClick={() => {
        onToggle(!expanded)
      }}
    >
      <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
    </button>
  )
}
