import type { PaneNode, PaneView } from './paneView'

/** A pane node with only a key, a name and no children, unless overridden. */
export function testPaneNode(key: string, overrides: Partial<PaneNode> = {}): PaneNode {
  const files = overrides.files === undefined ? [] : overrides.files
  return {
    key,
    kind: 'subagent',
    name: key,
    agentType: null,
    tokens: null,
    toolErrors: null,
    compactions: null,
    stopped: false,
    partial: false,
    files: [],
    fileCount: files?.length ?? null,
    filesIncomplete: false,
    children: [],
    ...overrides
  }
}

/** A ready pane view of a tree, unless overridden. */
export function testPaneView(root: PaneNode, overrides: Partial<PaneView> = {}): PaneView {
  return {
    sessionId: 's1',
    target: 'current',
    status: 'ready',
    errorCode: null,
    label: 'Fix the bug',
    totalTokens: null,
    totalTokensPartial: false,
    root,
    refreshedAtMs: 1,
    ...overrides
  }
}
