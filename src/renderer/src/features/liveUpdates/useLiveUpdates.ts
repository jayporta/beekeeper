import { useIsRestoring, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { ProjectDto } from '../../../../shared/ipc/projectDto'
import { createInvalidationApplier } from './createInvalidationApplier'
import { invalidationPlan } from './invalidationPlan'
import { useLiveUpdatesStore } from './state/useLiveUpdatesStore'

/**
 * Keeps the visible lists and details current while transcripts change. Each
 * batch from the main process refreshes the queries of the folders it names
 * (see `invalidationPlan`), unless live updates are paused. Turning them back
 * on refreshes everything visible once, to catch up, and pausing drops the
 * session detail refreshes still waiting. Batches are ignored
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
    const applier = createInvalidationApplier(client)
    const stopListening = window.beekeeper.onFilesChanged((change) => {
      if (useLiveUpdatesStore.getState().paused) return
      const projects = client.getQueryData<readonly ProjectDto[]>(['projects'])
      applier.apply(invalidationPlan(change, projects))
    })
    const stopWatchingSwitch = useLiveUpdatesStore.subscribe((state, previous) => {
      if (previous.paused && !state.paused) applier.applyAll()
      if (!previous.paused && state.paused) applier.cancelPending()
    })
    return () => {
      stopListening()
      stopWatchingSwitch()
      applier.dispose()
    }
  }, [client, isRestoring])
}
