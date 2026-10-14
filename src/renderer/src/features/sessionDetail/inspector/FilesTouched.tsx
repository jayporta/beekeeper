import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MutedText } from '@renderer/components/MutedText'
import type { AgentReportDto } from '../../../../../shared/ipc/agentDto'
import { FileDiffDialog } from '../fileDiff/FileDiffDialog'
import { useIsArchivedSession } from '../useIsArchivedSession'
import { FileRowContent } from './FileRowContent'
import styles from './FilesTouched.module.css'
import { groupFileTouches } from './groupFileTouches'
import type { InspectionTarget } from './inspectionTarget'
import { InspectorMarker } from './InspectorMarker'
import { InspectorSection } from './InspectorSection'

/** Props for {@link FilesTouched}. */
interface FilesTouchedProps {
  /** The agent's report. */
  readonly report: AgentReportDto
  /** Whose detail the report is, so a row can load that agent's diff. */
  readonly target: InspectionTarget
  /** The agent's name, shown in the diff dialog. Transcript-derived. */
  readonly agentName: string
}

/**
 * The files the agent's tools touched, one row per path: the path in
 * monospace on one line, cut at the start so the file name always shows (the
 * whole path is in the row's tooltip and in the page's text), a colored pill
 * for each distinct thing done to it, and how many times it was touched when
 * more than once. An agent with none says it is read-only, unless its list may be incomplete,
 * which it says with a "¹" instead of claiming so. Each row is a button that
 * opens a dialog with the agent's changes to that file, except in an archived
 * session, whose rows are plain text.
 *
 * @example
 * <FilesTouched report={report} target={target} agentName="scout" />
 */
export function FilesTouched({ report, target, agentName }: FilesTouchedProps): React.JSX.Element {
  const { t } = useTranslation('sessionDetail')
  const { fileTouches, fileListIncomplete } = report
  const files = useMemo(() => groupFileTouches(fileTouches), [fileTouches])
  const [openPath, setOpenPath] = useState<string | null>(null)
  // An archived session's transcript is not read, so its rows open nothing.
  const archived = useIsArchivedSession(target.ownerRef)
  const heading = t('inspector.filesHeading', { count: files.length })

  return (
    <InspectorSection
      heading={
        <>
          {heading}
          {fileListIncomplete && <InspectorMarker />}
        </>
      }
    >
      {files.length === 0 ? (
        <MutedText>
          {fileListIncomplete ? t('inspector.noEditsRecorded') : t('inspector.readOnly')}
        </MutedText>
      ) : (
        <ul className={styles.list}>
          {files.map(({ filePath, operations, touches }) => (
            <li key={filePath} className={styles.file}>
              {archived ? (
                <div className={styles.row}>
                  <FileRowContent filePath={filePath} operations={operations} touches={touches} />
                </div>
              ) : (
                <button
                  type="button"
                  className={`${styles.row} ${styles.button}`}
                  aria-haspopup="dialog"
                  onClick={() => setOpenPath(filePath)}
                >
                  <FileRowContent filePath={filePath} operations={operations} touches={touches} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <FileDiffDialog
        open={!archived && openPath !== null}
        onClose={() => setOpenPath(null)}
        target={{ ref: target.ownerRef, agentId: target.agentId, filePath: openPath ?? '' }}
        agentName={agentName}
      />
    </InspectorSection>
  )
}
