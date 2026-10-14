import type { BrowseView } from './browseView'

/** What {@link emptyBrowseView} takes: the status and the time, and any part that isn't empty. */
export type EmptyBrowseViewParts = Partial<BrowseView> &
  Pick<BrowseView, 'status' | 'refreshedAtMs'>

/**
 * A Browse view with nothing in it but what is given: no error, no projects, no rows.
 *
 * @param parts - The status and time, and the parts to fill in.
 * @returns The view.
 */
export function emptyBrowseView(parts: EmptyBrowseViewParts): BrowseView {
  return {
    errorCode: null,
    projects: [],
    projectDirName: null,
    rows: [],
    hiddenCount: 0,
    ...parts
  }
}
