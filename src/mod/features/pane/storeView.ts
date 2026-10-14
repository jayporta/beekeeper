import type { PaneHost } from './paneRefresherTypes'
import type { PaneView } from './paneView'

/**
 * Stores a view for the pane to draw. A write that rejects is logged by code, not rethrown.
 *
 * @param options - The pane's engine calls, the view, and a code-only log.
 * @returns Whether the engine kept the view.
 */
export async function storeView(options: {
  readonly pane: Pick<PaneHost, 'writeView'>
  readonly view: PaneView
  readonly log: (code: string) => void
}): Promise<boolean> {
  try {
    return await options.pane.writeView(options.view)
  } catch {
    options.log('pane-write-failed')
    return false
  }
}
