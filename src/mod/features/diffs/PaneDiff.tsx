import { diffFailureKey } from '../../../shared/worktrees/diffFailureKey'
import { uncommittedNoteKey } from '../../../shared/worktrees/uncommittedNoteKey'
import { t } from '../../i18n/modI18n'
import type { PaneNode } from '../pane/paneView'
import { errorLine } from '../shared/errorLine'
import type { PaneElements } from '../shared/paneElements'
import { diffFileLabel } from './diffLine'
import type { PaneDiffs } from './paneDiffs'

/** Props of {@link PaneDiff}. */
interface PaneDiffProps {
  /** The engine's elements for the surface. */
  readonly elements: PaneElements
  /** The selected node, which has a worktree. */
  readonly node: PaneNode
  /** The session the pane shows. */
  readonly sessionId: string
  /** The stored diff, which draws only when it is of this session and node. */
  readonly diffs: PaneDiffs | undefined
}

/** The lines under the heading: why the diff isn't there, or what it holds. */
function bodyOf(
  elements: PaneElements,
  diffs: PaneDiffs | undefined,
  node: PaneNode,
  sessionId: string
): object {
  const { Box, Text } = elements
  if (diffs?.sessionId !== sessionId || diffs.key !== node.key || diffs.status === 'loading') {
    return <Text>{t('diff.loading')}</Text>
  }
  if (diffs.status === 'error') return <Text>{errorLine(diffs.errorCode)}</Text>
  if (diffs.git === 'git-not-found') return <Text>{t('diff.gitNotFound')}</Text>
  if (diffs.git === 'git-too-old') return <Text>{t('diff.gitTooOld')}</Text>
  const { result } = diffs
  if (result === null) return <Text>{t('diff.failure.failed')}</Text>
  if (!result.ok) return <Text>{t(`diff.failure.${diffFailureKey(result.code)}`)}</Text>
  const note = uncommittedNoteKey(result.uncommitted)
  const hidden = result.fileCount - result.files.length
  const hiddenUntracked = result.untrackedCount - result.untracked.length
  return (
    <Box flexDirection="column">
      {note !== null && <Text>{t(`diff.${note}`)}</Text>}
      {result.fileCount === 0 && result.untrackedCount === 0 && <Text>{t('diff.none')}</Text>}
      {result.files.map((file, index) => (
        <Box key={String(index)} flexDirection="column">
          <Box flexDirection="row">
            <Text>{`${diffFileLabel(file)}  `}</Text>
            <Text wrap="truncate-start">{file.path}</Text>
          </Box>
          {file.oldPath !== null && (
            <Text wrap="truncate-start">{t('diff.renamedFrom', { path: file.oldPath })}</Text>
          )}
        </Box>
      ))}
      {hidden > 0 && <Text>{t('diff.moreFiles', { count: hidden })}</Text>}
      {result.untracked.map((path, index) => (
        <Box key={String(index)} flexDirection="row">
          <Text>{`${t('diff.untracked')}  `}</Text>
          <Text wrap="truncate-start">{path}</Text>
        </Box>
      ))}
      {hiddenUntracked > 0 && <Text>{t('diff.moreUntracked', { count: hiddenUntracked })}</Text>}
    </Box>
  )
}

/**
 * What the selected agent's worktree branch changed, from the stored diff: one line per file with
 * its added and deleted lines in words, then the untracked files. Fixed lines say why there is no
 * diff. A stored diff of another session or node draws as loading.
 *
 * @param props - The elements, the selected node, the session and the stored diff.
 * @returns The section.
 */
export function PaneDiff({ elements, node, sessionId, diffs }: PaneDiffProps): object {
  const { Box, Text } = elements
  return (
    <Box flexDirection="column">
      <Box flexDirection="row">
        <Text bold>{`${t('diff.heading')} `}</Text>
        <Text bold wrap="truncate-start">
          {node.worktree?.branch ?? ''}
        </Text>
      </Box>
      {bodyOf(elements, diffs, node, sessionId)}
    </Box>
  )
}
