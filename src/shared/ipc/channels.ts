/** The IPC channel names between the renderer and the main process. */
export const IPC_CHANNELS = {
  listProjects: 'beekeeper:list-projects',
  listSessions: 'beekeeper:list-sessions',
  getSession: 'beekeeper:get-session',
  getWorktreeDiffs: 'beekeeper:get-worktree-diffs',
  getProjectTotals: 'beekeeper:get-project-totals',
  getWorktreePatch: 'beekeeper:get-worktree-patch'
} as const

/** One of the channel names in {@link IPC_CHANNELS}. */
export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]

/**
 * The events the main process sends to the renderer. They are not in
 * {@link IPC_CHANNELS}, which holds only the request channels that get a handler.
 */
export const IPC_EVENTS = {
  openAbout: 'beekeeper:open-about'
} as const
