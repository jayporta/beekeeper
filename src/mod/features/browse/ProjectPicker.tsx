import { t } from '../../i18n/modI18n'
import type { PaneElements } from '../pane/paneElements'
import type { BrowseProject } from './browseView'

/** Props of {@link ProjectPicker}. */
interface ProjectPickerProps {
  /** The engine's elements for the surface. */
  readonly elements: PaneElements
  /** The projects to pick from, at least one. */
  readonly projects: readonly BrowseProject[]
  /** The picked project's folder, or `null` for none. */
  readonly projectDirName: string | null
  /** Runs with the folder of the project picked. */
  readonly onPick: (dirName: string) => void | Promise<void>
}

/**
 * The project picker: a `Select` where the surface has one, else a `Button` per project with a
 * word marking the picked one. Draw it only with at least one project: a `Select` needs one option.
 *
 * @param props - The elements, the projects, the picked one and the handler.
 * @returns The picker.
 */
export function ProjectPicker({
  elements,
  projects,
  projectDirName,
  onPick
}: ProjectPickerProps): object {
  const { Box, Button, Select, Text } = elements
  if (Select !== undefined) {
    return (
      <Select
        key="beekeeper-project"
        label={t('browse.project')}
        options={projects.map(({ dirName, label }) => ({ value: dirName, label }))}
        value={projectDirName ?? undefined}
        onSelect={onPick}
      />
    )
  }
  return (
    <Box flexDirection="column">
      {projects.map(({ dirName, label }) => (
        <Button key={`project:${dirName}`} onPress={() => onPick(dirName)}>
          <Text wrap="truncate-end">
            {dirName === projectDirName ? t('row.selected') : t('row.unselected')}
            {label}
          </Text>
        </Button>
      ))}
    </Box>
  )
}
