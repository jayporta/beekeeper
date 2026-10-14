import { useTranslation } from 'react-i18next'
import { MutedText } from '@renderer/components/MutedText'
import { Pill } from '@renderer/components/Pill'
import type { FileTouchDto } from '../../../../../shared/ipc/agentDto'
import styles from './FileRowContent.module.css'
import { operationTone } from './operationTone'

/** Props for {@link FileRowContent}. */
interface FileRowContentProps {
  /** The file's path as the tool reported it. Untrusted text. */
  readonly filePath: string
  /** The distinct things done to the file. */
  readonly operations: readonly FileTouchDto['operation'][]
  /** How many times the file was touched. */
  readonly touches: number
}

/**
 * The two cells of a Files touched row, for a grid parent: the path in
 * monospace on one line, cut at the start so the file name shows, and a pill
 * for each thing done to it with the touch count when more than once.
 *
 * @example
 * <FileRowContent filePath="/repo/a.ts" operations={['edit']} touches={2} />
 */
export function FileRowContent({
  filePath,
  operations,
  touches
}: FileRowContentProps): React.JSX.Element {
  const { t } = useTranslation('sessionDetail')

  return (
    <>
      <span className={styles.path} title={filePath}>
        <bdi dir="ltr">{filePath}</bdi>
      </span>
      <span className={styles.tags}>
        {operations.map((operation) => (
          <Pill key={operation} tone={operationTone(operation)}>
            {t(`inspector.operation.${operation}`)}
          </Pill>
        ))}
        {touches > 1 && (
          <>
            <MutedText as="span" smaller decorative>
              {t('inspector.touchCount', { count: touches })}
            </MutedText>
            <span className="visuallyHidden">
              {t('inspector.touchCountSpoken', { count: touches })}
            </span>
          </>
        )}
      </span>
    </>
  )
}
