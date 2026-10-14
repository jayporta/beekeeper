import { createDiffsRefresher } from '../diffs/createDiffsRefresher'
import { createPatchRefresher } from '../patch/createPatchRefresher'
import type { PaneServices } from '../shared/paneServices'
import type { PaneHost } from './paneRefresherTypes'
import type { PaneView } from './paneView'

/** Loads what a session view's selected agent has in its worktree. */
export interface WorktreeLoader {
  /**
   * Loads the selected agent's worktree diff, then the patch a press asked for, for a built
   * session view. A stored selection that can't be read is none. Never rejects.
   *
   * @param view - The view that was just built.
   * @param services - The service calls, or `null` before any were built, which loads nothing.
   */
  load(view: PaneView, services: PaneServices | null): Promise<void>
  /** Forgets what the diff refresher last stored, so the next load writes even a diff that matches. */
  forgetStored(): void
}

/**
 * Builds the loader of the worktree diff and patch. It holds the refreshers' state, so build one
 * per refresher.
 *
 * @param deps - The pane's engine calls and a code-only log.
 * @returns The loader.
 */
export function createWorktreeLoader(deps: {
  readonly pane: PaneHost
  readonly log: (code: string) => void
}): WorktreeLoader {
  const { pane, log } = deps
  const diffs = createDiffsRefresher({ writeDiffs: (value) => pane.writeDiffs(value), log })
  const patches = createPatchRefresher({
    readPatch: () => pane.patch(),
    writePatch: (value) => pane.writePatch(value),
    log
  })

  return {
    load: async (view, services) => {
      if (services === null) return
      let selected = null
      try {
        selected = await pane.selected()
      } catch {
        selected = null
      }
      const input = { services, view, selected, nowMs: view.refreshedAtMs }
      await diffs.refresh(input)
      await patches.refresh(input)
    },
    forgetStored: diffs.forgetStored
  }
}
