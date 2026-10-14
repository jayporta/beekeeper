import { t } from '../../i18n/modI18n'
import type { PaneDiffFile } from './paneDiffs'

/**
 * What a changed file's line says before its path, in words so it never rests on color: the
 * lines added and deleted, or `Binary` when git counts none.
 *
 * @param file - A changed file.
 * @returns The label.
 */
export function diffFileLabel(file: PaneDiffFile): string {
  if (file.added === null || file.deleted === null) return t('diff.binary')
  return t('diff.counts', { added: file.added, deleted: file.deleted })
}
