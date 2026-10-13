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
  filesIncomplete: boolean
  children: readonly BeekeeperPaneNode[]
}

/** What the pane draws: the session's tree, or why there isn't one. */
export type BeekeeperPaneView = {
  sessionId: string
  status: 'loading' | 'ready' | 'waiting' | 'error'
  errorCode: 'invalid-request' | 'untrusted-sender' | 'not-found' | 'unreadable' | 'internal' | null
  label: string | null
  totalTokens: number | null
  totalTokensPartial: boolean
  root: BeekeeperPaneNode | null
  refreshedAtMs: number
}

declare module 'claude-code' {
  interface PluginState {
    beekeeper: {
      /** The current session's tree, rebuilt by every refresh. */
      view: BeekeeperPaneView
      /** The node the person selected, or `null` for none. */
      selected: { sessionId: string; key: string } | null
    }
  }
}
