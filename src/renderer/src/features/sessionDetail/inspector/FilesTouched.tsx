import { useTranslation } from 'react-i18next'
import { useMemo } from 'react'
import type { AgentReportDto } from '../../../../../shared/ipc/agentDto'
import styles from './FilesTouched.module.css'
import { groupFileTouches } from './groupFileTouches'
import { InspectorMarker } from './InspectorMarker'

/** Props for {@link FilesTouched}. */
interface FilesTouchedProps {
  /** The agent's report. */
  readonly report: AgentReportDto
}

/**
 * The files the agent's tools touched, one row per path: the path in
 * monospace, whole and wrapping so none of it is hidden, a neutral tag for each
 * distinct thing done to it, and how many times it was touched when more than
 * once. An agent with none says it is read-only, unless its list may be incomplete,
 * which it says with a "¹" instead of claiming so.
 *
 * @example
 * <FilesTouched report={report} />
 */
export function FilesTouched({ report }: FilesTouchedProps): React.JSX.Element {
  const { t } = useTranslation('sessionDetail')
  const { fileTouches, fileListIncomplete } = report
  const files = useMemo(() => groupFileTouches(fileTouches), [fileTouches])

  return (
    <section className={styles.section}>
      <h3 className={styles.heading}>
        {t('inspector.filesHeading', { count: files.length })}
        {fileListIncomplete && <InspectorMarker />}
      </h3>
      {files.length === 0 ? (
        <p className={styles.empty}>
          {fileListIncomplete ? t('inspector.noEditsRecorded') : t('inspector.readOnly')}
        </p>
      ) : (
        <ul className={styles.files}>
          {files.map(({ filePath, operations, touches }) => (
            <li key={filePath} className={styles.file}>
              <span className={styles.path}>
                <bdi>{filePath}</bdi>
              </span>
              <span className={styles.tags}>
                {operations.map((operation) => (
                  <span key={operation} className={styles.tag}>
                    {t(`inspector.operation.${operation}`)}
                  </span>
                ))}
                {touches > 1 && (
                  <>
                    <span className={styles.count} aria-hidden="true">
                      {t('inspector.touchCount', { count: touches })}
                    </span>
                    <span className="visuallyHidden">
                      {t('inspector.touchCountSpoken', { count: touches })}
                    </span>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
