import { diffFailureKey } from '../../../shared/worktrees/diffFailureKey'
import { uncommittedNoteKey } from '../../../shared/worktrees/uncommittedNoteKey'
import { t } from '../../i18n/modI18n'
import type { PaneNode } from '../pane/paneView'
import { errorLine } from '../shared/errorLine'
import type { PaneElements } from '../shared/paneElements'
import { codeFormat } from './hunks'
import type { PanePatch, PatchPane } from './panePatch'

/** Props of {@link PanePatchView}. */
interface PanePatchViewProps {
  /** The engine's elements for the surface. */
  readonly elements: PaneElements
  /** The selected node, which has a worktree. */
  readonly node: PaneNode
  /** The session the pane shows. */
  readonly sessionId: string
  /** Whether the node's diff lists files, which is what a patch needs. */
  readonly hasFiles: boolean
  /** The stored patch and the handlers that show and hide it. */
  readonly patch: PatchPane
}

/** The patch's own lines: a fixed line for each failure, then each file's header and text. */
function bodyOf(elements: PaneElements, patch: PanePatch): object {
  const { Box, Text, Code } = elements
  if (patch.status === 'loading') return <Text>{t('patch.loading')}</Text>
  if (patch.status === 'error') return <Text>{errorLine(patch.errorCode)}</Text>
  const { failure } = patch
  if (failure !== null) {
    if ('git' in failure) {
      return (
        <Text>{t(failure.git === 'git-not-found' ? 'diff.gitNotFound' : 'diff.gitTooOld')}</Text>
      )
    }
    return <Text>{t(`diff.failure.${diffFailureKey(failure.code)}`)}</Text>
  }
  const note = patch.uncommitted === null ? null : uncommittedNoteKey(patch.uncommitted)
  const isCut = patch.omittedCount > 0 || patch.files.some((file) => file.truncated)
  return (
    <Box flexDirection="column">
      {note !== null && <Text>{t(`diff.${note}`)}</Text>}
      {patch.files.length === 0 && patch.omittedCount === 0 && <Text>{t('diff.none')}</Text>}
      {patch.files.map((file, index) => (
        <Box key={String(index)} flexDirection="column">
          <Text bold wrap="truncate-start">
            {file.path}
          </Text>
          {file.oldPath !== null && (
            <Text wrap="truncate-start">{t('diff.renamedFrom', { path: file.oldPath })}</Text>
          )}
          <Code source={file.text} format={codeFormat(file.text)} />
        </Box>
      ))}
      {patch.omittedCount > 0 && <Text>{t('patch.omitted', { count: patch.omittedCount })}</Text>}
      {isCut && <Text>{t('patch.cut')}</Text>}
    </Box>
  )
}

/**
 * The button that shows or hides the selected agent's patch, and the patch under it: each
 * file's header and its unified diff. It shows only when the diff lists files, and the stored
 * patch draws only when it is of this session and node.
 *
 * @param props - The elements, the selected node, the session, whether the diff has files, and the patch.
 * @returns The section.
 */
export function PanePatchView({
  elements,
  node,
  sessionId,
  hasFiles,
  patch
}: PanePatchViewProps): object {
  const { Box, Button, Text } = elements
  const { stored } = patch
  const isShown =
    stored !== undefined &&
    stored.status !== 'none' &&
    stored.sessionId === sessionId &&
    stored.key === node.key
  if (!hasFiles) return <Box flexDirection="column" />
  return (
    <Box flexDirection="column">
      <Button
        key="patch-toggle"
        onPress={() => (isShown ? patch.onHide() : patch.onShow(node.key))}
      >
        <Text>{t(isShown ? 'patch.hide' : 'patch.show')}</Text>
      </Button>
      {isShown ? bodyOf(elements, stored) : null}
    </Box>
  )
}
