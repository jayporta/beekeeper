import { useTranslation } from 'react-i18next'
import styles from './AgentInspector.module.css'

/** Props for {@link InspectorPendingNote}. */
interface InspectorPendingNoteProps {
  /** Whether the detail is still loading, which is announced politely, rather than unreadable. */
  readonly loading: boolean
  /**
   * Whether the inspector is showing a workflow run rather than an agent, which the note names.
   *
   * @defaultValue false
   */
  readonly workflow?: boolean
}

/**
 * The note under the inspector's header while the data it needs is still
 * loading, or once it can't be read. It names the agent or the workflow run.
 * Loading is announced politely.
 *
 * @example
 * <InspectorPendingNote loading workflow />
 */
export function InspectorPendingNote({
  loading,
  workflow = false
}: InspectorPendingNoteProps): React.JSX.Element {
  const { t } = useTranslation('sessionDetail')
  const text = workflow
    ? t(loading ? 'inspector.workflow.loading' : 'inspector.workflow.unreadable')
    : t(loading ? 'inspector.loading' : 'inspector.unreadable')

  return (
    <p className={styles.note} role={loading ? 'status' : undefined}>
      {text}
    </p>
  )
}
