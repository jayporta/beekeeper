import { t } from '../../i18n/modI18n'
import type { PaneElements } from './paneElements'
import type { PaneNode } from './paneView'

/** How many files the pane lists before it says how many more there are. */
export const MAX_LISTED_FILES = 200

/** What a tool did to a file, in a word. An operation the pane doesn't know reads as a change. */
function operationWord(operation: string): string {
  switch (operation) {
    case 'edit':
      return t('files.operation.edit')
    case 'create':
      return t('files.operation.create')
    case 'update':
      return t('files.operation.update')
    case 'delete':
      return t('files.operation.delete')
    default:
      return t('files.operation.change')
  }
}

/** Props of {@link PaneFiles}. */
interface PaneFilesProps {
  /** The engine's elements for the surface. */
  readonly elements: PaneElements
  /** The selected node. */
  readonly node: PaneNode
}

/**
 * The files the selected agent changed, one line each, capped. A teammate's
 * and a workflow run's files show elsewhere, and a line says so.
 *
 * @param props - The elements and the selected node.
 * @returns The section.
 */
export function PaneFiles({ elements, node }: PaneFilesProps): object {
  const { Box, Text } = elements
  const { files } = node
  const listed = files?.slice(0, MAX_LISTED_FILES) ?? []
  return (
    <Box flexDirection="column">
      <Text bold>{t('files.heading', { name: node.name })}</Text>
      {files === null && (
        <Text>{t(node.kind === 'teammate' ? 'files.teammate' : 'files.workflow')}</Text>
      )}
      {files?.length === 0 && <Text>{t('files.none')}</Text>}
      {listed.map((file, index) => (
        <Box key={String(index)}>
          <Text wrap="truncate-end">{`${operationWord(file.operation)} ${file.path}`}</Text>
        </Box>
      ))}
      {files !== null && files.length > MAX_LISTED_FILES && (
        <Text>{t('files.more', { count: files.length - MAX_LISTED_FILES })}</Text>
      )}
      {node.filesIncomplete && <Text>{t('files.incomplete')}</Text>}
    </Box>
  )
}
