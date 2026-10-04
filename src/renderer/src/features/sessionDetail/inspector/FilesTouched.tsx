import { useTranslation } from 'react-i18next'
import type { AgentReportDto } from '../../../../../shared/ipc/agentDto'
import styles from './FilesTouched.module.css'
import { InspectorMarker } from './InspectorMarker'

/** Props for {@link FilesTouched}. */
interface FilesTouchedProps {
  /** The agent's report. */
  readonly report: AgentReportDto
}

/**
 * The files the agent's tools touched: each path in monospace, whole and
 * wrapping so none of it is hidden, with a neutral tag for what was done to it.
 * An agent with none says it is read-only, unless its list may be incomplete,
 * which it says with a "¹" instead of claiming so.
 *
 * @example
 * <FilesTouched report={report} />
 */
export function FilesTouched({ report }: FilesTouchedProps): React.JSX.Element {
  const { t } = useTranslation('sessionDetail')
  const { fileTouches, fileListIncomplete } = report

  return (
    <section className={styles.section}>
      <h3 className={styles.heading}>
        {t('inspector.filesHeading', { count: fileTouches.length })}
        {fileListIncomplete && <InspectorMarker />}
      </h3>
      {fileTouches.length === 0 ? (
        <p className={styles.empty}>
          {fileListIncomplete ? t('inspector.noEditsRecorded') : t('inspector.readOnly')}
        </p>
      ) : (
        <ul className={styles.files}>
          {fileTouches.map((touch, index) => (
            <li key={`${index}:${touch.filePath}`} className={styles.file}>
              <span className={styles.path}>
                <bdi>{touch.filePath}</bdi>
              </span>
              <span className={styles.tag}>{t(`inspector.operation.${touch.operation}`)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
