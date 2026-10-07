import { useTranslation } from 'react-i18next'
import { InspectorSection } from './InspectorSection'
import styles from './WorkflowPhases.module.css'

/** Props for {@link WorkflowPhases}. */
interface WorkflowPhasesProps {
  /** The titles of the run's phases, in order. Transcript-derived. */
  readonly phases: readonly string[]
}

/**
 * The phases of a workflow run as a numbered list under a heading. It renders
 * nothing when the run has none. Titles are transcript-derived, so each shows
 * as plain text, isolated from the text around it.
 *
 * @example
 * <WorkflowPhases phases={['plan', 'execute', 'report']} />
 */
export function WorkflowPhases({ phases }: WorkflowPhasesProps): React.JSX.Element | null {
  const { t } = useTranslation('sessionDetail')
  if (phases.length === 0) return null
  const heading = t('inspector.workflow.phasesHeading')

  return (
    <InspectorSection heading={heading}>
      <ol className={styles.phases}>
        {phases.map((phase, index) => (
          // The list never reorders, and titles can repeat, so the index is the identity.
          <li key={index}>
            <bdi>{phase}</bdi>
          </li>
        ))}
      </ol>
    </InspectorSection>
  )
}
