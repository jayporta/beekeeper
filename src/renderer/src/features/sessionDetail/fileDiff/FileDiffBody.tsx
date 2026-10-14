import { useTranslation } from 'react-i18next'
import { MutedText } from '@renderer/components/MutedText'
import { IpcCallError } from '@renderer/ipc/ipcCallError'
import { FileChangeView } from './FileChangeView'
import styles from './FileDiffBody.module.css'
import type { FileDiffTarget } from './fileDiffTarget'
import { useFileDiff } from './useFileDiff'

/** Props for {@link FileDiffBody}. */
interface FileDiffBodyProps {
  /** The agent and file to show. */
  readonly target: FileDiffTarget
}

/**
 * What the file diff dialog shows once it is open: the changes loading, why
 * they can't be shown, or the agent's changes to the file in order. A diff cut
 * at the size cap says so.
 *
 * One status region stays mounted and holds the outcome, so a screen reader
 * hears that the changes loaded or failed while focus stays on the dialog's
 * Close button. Once changes show, its text is visually hidden, so the patch
 * text itself is never announced.
 *
 * @example
 * <FileDiffBody target={{ ref, agentId: null, filePath: '/repo/a.ts' }} />
 */
export function FileDiffBody({ target }: FileDiffBodyProps): React.JSX.Element {
  const { t } = useTranslation('sessionDetail')
  const { data, error, isError } = useFileDiff(target)

  function outcome(): string {
    if (data !== undefined) return t('inspector.fileDiff.loaded', { count: data.changes.length })
    if (!isError) return t('inspector.fileDiff.loading')
    return IpcCallError.codeOf(error) === 'not-found'
      ? t('inspector.fileDiff.gone')
      : t('inspector.fileDiff.loadFailed')
  }

  return (
    <div className={styles.body}>
      <div role="status" className={styles.status}>
        <MutedText className={data === undefined ? undefined : 'visuallyHidden'}>
          {outcome()}
        </MutedText>
        {data?.truncated === true && <MutedText>{t('inspector.fileDiff.truncated')}</MutedText>}
      </div>
      {data?.changes.map((change, index) => (
        <FileChangeView key={index} change={change} index={index + 1} count={data.changes.length} />
      ))}
    </div>
  )
}
