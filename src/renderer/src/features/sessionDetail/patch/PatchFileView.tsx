import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { WorktreePatchFileDto } from '../../../../../shared/ipc/worktreePatchDto'
import styles from './PatchFileView.module.css'
import { patchRuns } from './patchRuns'

/** Props for {@link PatchFileView}. */
interface PatchFileViewProps {
  /** The file and its patch. */
  readonly file: WorktreePatchFileDto
}

/**
 * One changed file in the patch view: its path as a heading, where a rename
 * came from, and its patch as plain text in a `<pre>`, with each added or
 * removed line colored by its first character. The patch is never parsed as
 * markup. A file whose patch was cut, or left out, says so.
 *
 * @example
 * <PatchFileView file={{ path: 'a.ts', patch: '+x\n', truncated: false }} />
 */
export function PatchFileView({ file }: PatchFileViewProps): React.JSX.Element {
  const { t } = useTranslation('sessionDetail')
  const runs = useMemo(() => patchRuns(file.patch), [file.patch])

  return (
    <section className={styles.file}>
      <h3 className={styles.path}>
        <bdi>{file.path}</bdi>
      </h3>
      {file.oldPath !== undefined && (
        <p className={styles.note}>
          <bdi>{t('inspector.patch.renamedFrom', { path: file.oldPath })}</bdi>
        </p>
      )}
      {file.patch !== '' && (
        <pre className={styles.patch}>
          {runs.map((run, index) => (
            <span key={index} className={styles.run} data-kind={run.kind}>
              {run.text}
            </span>
          ))}
        </pre>
      )}
      {file.truncated && <p className={styles.note}>{t('inspector.patch.fileTruncated')}</p>}
    </section>
  )
}
