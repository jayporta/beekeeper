/**
 * The values the beekeeper mod keeps in `$.state`. `src/mod/features/pane/paneView.ts` holds the
 * same shape for the code that builds it; a test checks the two agree.
 */

/** One changed file of an agent. */
export type BeekeeperPaneFile = {
  path: string
  operation: string
}

/** One node of the pane's agent tree. */
export type BeekeeperPaneNode = {
  key: string
  kind: string
  name: string
  agentType: string | null
  tokens: number | null
  toolErrors: number | null
  compactions: number | null
  stopped: boolean
  partial: boolean
  files: readonly BeekeeperPaneFile[] | null
  fileCount: number | null
  filesIncomplete: boolean
  /** The worktree branch a subagent ran on, or `null` for any other node. */
  worktree: {
    projectDirName: string
    sessionId: string
    agentId: string
    branch: string
  } | null
  children: readonly BeekeeperPaneNode[]
}

/** What the pane draws: the session's tree, or why there isn't one. */
export type BeekeeperPaneView = {
  sessionId: string
  /** Whether the view is of the engine's own session or one the person browsed to. */
  target: 'current' | 'browsed'
  status: 'loading' | 'ready' | 'waiting' | 'error'
  errorCode:
    | 'invalid-request'
    | 'untrusted-sender'
    | 'not-found'
    | 'unreadable'
    | 'internal'
    | 'too-old'
    | 'start-failed'
    | null
  label: string | null
  totalTokens: number | null
  totalTokensPartial: boolean
  root: BeekeeperPaneNode | null
  /** When the view's content last changed, in milliseconds since the epoch: a refresh that finds nothing new stores nothing. */
  refreshedAtMs: number
}

/** One changed file of a worktree branch. */
export type BeekeeperDiffFile = {
  path: string
  oldPath: string | null
  /** Lines added, or `null` for a binary file. */
  added: number | null
  deleted: number | null
}

/** The selected agent's worktree diff, or why there isn't one. */
export type BeekeeperDiffs = {
  sessionId: string
  key: string
  status: 'loading' | 'ready' | 'error' | 'none'
  errorCode:
    | 'invalid-request'
    | 'untrusted-sender'
    | 'not-found'
    | 'unreadable'
    | 'internal'
    | 'too-old'
    | 'start-failed'
    | null
  git: 'ok' | 'git-not-found' | 'git-too-old' | null
  result:
    | {
        ok: true
        uncommitted: 'included' | 'no-worktree' | 'skipped-filters' | 'worktree-mismatch'
        files: readonly BeekeeperDiffFile[]
        fileCount: number
        untracked: readonly string[]
        untrackedCount: number
      }
    | {
        ok: false
        code:
          | 'invalid-ref'
          | 'invalid-path'
          | 'branch-not-found'
          | 'git-failed'
          | 'no-common-ancestor'
          | 'malformed-numstat'
          | 'output-too-large'
          | 'timeout'
          | 'spawn-failed'
          | 'repo-missing'
          | 'not-a-repo'
          | 'outside-project'
          | 'no-base'
          | 'too-many-agents'
      }
    | null
  refreshedAtMs: number
}

/** Which screen the pane shows; a missing value is `current`. */
export type BeekeeperNav =
  | { screen: 'current' }
  | { screen: 'browse'; projectDirName: string | null; openId?: number }
  | { screen: 'session'; ref: { projectDirName: string; sessionId: string }; backTo: string }

/** One project in the Browse picker. */
export type BeekeeperBrowseProject = {
  dirName: string
  label: string
}

/** One session row of the Browse screen. */
export type BeekeeperBrowseRow = {
  key: string
  ref: { projectDirName: string; sessionId: string }
  label: string
  depth: 0 | 1
  tokens: number | null
  tokensPartial: boolean
  lastActiveMs: number | null
  agents: string | null
}

/** What the Browse screen draws. */
export type BeekeeperBrowseView = {
  status: 'loading' | 'ready' | 'error'
  errorCode: BeekeeperPaneView['errorCode']
  projects: readonly BeekeeperBrowseProject[]
  projectDirName: string | null
  rows: readonly BeekeeperBrowseRow[]
  hiddenCount: number
  /** When the view's content last changed, in milliseconds since the epoch. */
  refreshedAtMs: number
}

declare module 'claude-code' {
  interface PluginState {
    beekeeper: {
      /** The current session's tree, rebuilt by every refresh. */
      view: BeekeeperPaneView
      /** The node the person selected, or `null` for none. */
      selected: { sessionId: string; key: string } | null
      /** Which screen the pane shows. Only the pane's press handlers write it. */
      nav: BeekeeperNav
      /** The Browse screen's data, rebuilt by every Browse refresh. */
      browse: BeekeeperBrowseView
      /** The selected agent's worktree diff, loaded by the refresher; `none` status when the selected node has no worktree. */
      diffs: BeekeeperDiffs
    }
  }
}
