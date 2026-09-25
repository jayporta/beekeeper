/** The IPC channel names between the renderer and the main process. */
export const IPC_CHANNELS = {
  listProjects: 'beekeeper:list-projects',
  listSessions: 'beekeeper:list-sessions',
  getSession: 'beekeeper:get-session',
  getWorktreeDiffs: 'beekeeper:get-worktree-diffs'
} as const

/** One of the channel names in {@link IPC_CHANNELS}. */
export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]
