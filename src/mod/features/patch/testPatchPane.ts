import type { PanePatch, PatchPane } from './panePatch'

/** A patch pane with no stored patch and handlers that do nothing, unless overridden. */
export function testPatchPane(overrides: Partial<PatchPane> = {}): PatchPane {
  return { stored: undefined, onShow: () => {}, onHide: () => {}, ...overrides }
}

/** A patch pane holding `stored`. */
export function testPatchPaneOf(stored: PanePatch, overrides: Partial<PatchPane> = {}): PatchPane {
  return testPatchPane({ stored, ...overrides })
}
