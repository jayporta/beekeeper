import { useIsRestoring, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { FilesChangedDto } from '../../../../shared/ipc/filesChangedDto'
import type { ProjectDto } from '../../../../shared/ipc/projectDto'
import { applyInvalidationPlan } from './applyInvalidationPlan'
import { invalidationPlan } from './invalidationPlan'
import { useLiveUpdatesStore } from './state/useLiveUpdatesStore'

/** The change that makes everything visible refresh, as when live updates resume. */
const EVERYTHING: FilesChangedDto = { dirNames: [], foldersChanged: true, all: true }

/**
 * Keeps the visible lists and details current while transcripts change. Each
 * batch from the main process refreshes the queries of the folders it names
 * (see `invalidationPlan`), unless live updates are paused. Turning them back
 * on refreshes everything visible once, to catch up. Batches are ignored
 * while the persisted cache is still being restored, since a restore would
 * overwrite what they fetch. The subscriptions are held across a pause and a
 * resume, and removed on unmount. The notice that live updates stopped is
 * always recorded.
 */
export function useLiveUpdates(): void {
  const client = useQueryClient()
  const isRestoring = useIsRestoring()

  useEffect(
    () => window.beekeeper.onLiveUpdatesUnavailable(useLiveUpdatesStore.getState().markUnavailable),
    []
  )

  useEffect(() => {
    if (isRestoring) return
    const apply = (change: FilesChangedDto): void => {
      const projects = client.getQueryData<readonly ProjectDto[]>(['projects'])
      applyInvalidationPlan(client, invalidationPlan(change, projects))
    }
    const stopListening = window.beekeeper.onFilesChanged((change) => {
      if (!useLiveUpdatesStore.getState().paused) apply(change)
    })
    const stopWatchingSwitch = useLiveUpdatesStore.subscribe((state, previous) => {
      if (previous.paused && !state.paused) apply(EVERYTHING)
    })
    return () => {
      stopListening()
      stopWatchingSwitch()
    }
  }, [client, isRestoring])
}
