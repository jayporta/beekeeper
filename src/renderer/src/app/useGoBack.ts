import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { ProjectDto } from '../../../shared/ipc/projectDto'
import { useAnnouncement } from '@renderer/components/useAnnouncement'
import { entryOf } from '@renderer/features/navigation/state/navigationHistory'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { useSelectedProjectStore } from '@renderer/features/projects/state/useSelectedProjectStore'
import { canRestoreEntry } from './canRestoreEntry'

/** What {@link useGoBack} returns. */
interface GoBack {
  /** Whether the history has an entry to return to. */
  readonly canGoBack: boolean
  /** Returns to the newest place that can still be shown. When there is none it says so through `announcement`. */
  readonly goBack: () => void
  /** What a status region should say now, which is empty until a press leads nowhere. */
  readonly announcement: { readonly message: string; readonly id: number }
}

/**
 * Back for the whole app. It returns to the newest history entry that can
 * still be shown (see {@link canRestoreEntry}), dropping the newer ones that
 * cannot: those whose project is gone, that are the place already on screen,
 * or whose session is known to be gone. When the entry belongs to another
 * project it selects that project too, marking the change as intended so the
 * app's reset on a project change keeps the restored session. It counts as a
 * navigation, so focus moves like it does for any other.
 *
 * It reads the project list and the cache when it is called, not when it was
 * made, so a project dropped by a refetch just before is skipped. A press that
 * finds no place to show, whether the history is empty or every entry in it is
 * skipped, is announced as "Nothing to go back to" through `announcement`, so a
 * screen reader hears it. It waits, saying nothing, while the project list has
 * not loaded.
 *
 * Call it from any control or shortcut that goes back. It lives in the app
 * shell because it ties navigation to the projects and session detail
 * features, which navigation does not depend on.
 *
 * @returns Whether Back is possible, the function that goes back, and the announcement for a status region.
 */
export function useGoBack(): GoBack {
  const canGoBack = useNavigationStore((state) => state.history.length > 0)
  const client = useQueryClient()
  const { t } = useTranslation('navigation')
  const { message, id, announce } = useAnnouncement()

  const goBack = useCallback(() => {
    const projects = client.getQueryData<readonly ProjectDto[]>(['projects'])
    if (projects === undefined) return
    const navigation = useNavigationStore.getState()
    const current = entryOf(navigation)
    let entry = navigation.popEntry()
    while (entry !== undefined && !canRestoreEntry(entry, { projects, client, current })) {
      entry = navigation.popEntry()
    }
    if (entry === undefined) {
      announce(t('back.nothing'))
      return
    }
    const project = entry.projectDirName
    const switching = project !== null && project !== navigation.currentProjectDirName
    if (switching) navigation.markRestoringProject(project)
    navigation.restore(entry)
    if (switching) useSelectedProjectStore.getState().select(project)
  }, [client, announce, t])

  return { canGoBack, goBack, announcement: { message, id } }
}
