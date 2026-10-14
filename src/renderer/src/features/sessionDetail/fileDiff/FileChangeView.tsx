import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { FileChangeDto } from '../../../../../shared/ipc/fileDiffDto'
import { MutedText } from '@renderer/components/MutedText'
import { Pill } from '@renderer/components/Pill'
import { operationTone } from '../inspector/operationTone'
import { PatchText } from '../patch/PatchText'
import styles from './FileChangeView.module.css'
import { hunksToPatch } from './hunksToPatch'

/** Props for {@link FileChangeView}. */
interface FileChangeViewProps {
  /** The change to show. */
  readonly change: FileChangeDto
  /** The change's place in the agent's changes to the file, counting from 1. */
  readonly index: number
  /** How many changes the agent made to the file. */
  readonly count: number
}

/**
 * One change an agent made to a file: a heading with its place in the list and
 * what the call did, then its patch as plain text. Notes say what the patch
 * can't: a change made by a Bash command, a diff that may include changes made
 * outside it, an edit the person changed before accepting it, a change with no
 * recorded diff, and a patch with no lines, and a change the size cap cut.
 *
 * @example
 * <FileChangeView change={change} index={1} count={3} />
 */
export function FileChangeView({ change, index, count }: FileChangeViewProps): React.JSX.Element {
  const { t } = useTranslation('sessionDetail')
  const hunks = change.kind === 'patch' ? change.hunks : null
  const patch = useMemo(() => (hunks === null ? '' : hunksToPatch(hunks)), [hunks])

  return (
    <section className={styles.change}>
      <div className={styles.heading}>
        <h3 className={styles.title}>{t('inspector.fileDiff.changeHeading', { index, count })}</h3>
        <Pill tone={operationTone(change.operation)}>
          {t(`inspector.operation.${change.operation}`)}
        </Pill>
      </div>
      {change.source === 'bash' && <MutedText>{t('inspector.fileDiff.viaBash')}</MutedText>}
      {change.kind === 'patch' && change.shared && (
        <MutedText>{t('inspector.fileDiff.shared')}</MutedText>
      )}
      {change.kind === 'patch' && change.userModified && (
        <MutedText>{t('inspector.fileDiff.userModified')}</MutedText>
      )}
      {change.kind === 'unrecorded' && <MutedText>{t('inspector.fileDiff.unrecorded')}</MutedText>}
      {patch !== '' && <PatchText patch={patch} />}
      {change.kind === 'patch' && change.cut && (
        <MutedText>{t('inspector.fileDiff.cut')}</MutedText>
      )}
      {change.kind === 'patch' && !change.cut && patch === '' && (
        <MutedText>{t('inspector.fileDiff.noLines')}</MutedText>
      )}
    </section>
  )
}
