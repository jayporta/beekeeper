import type { ModHost } from '../../modHost'
import type { BrowseView } from '../browse/browseView'
import type { StartOutcome } from '../start/startMod'
import type { PaneNav } from './paneNav'
import type { PaneView } from './paneView'
import type { PaneServices } from './refreshPane'

/** The engine calls the pane's refresh makes, as closures so lib never sees `$`. */
export interface PaneHost {
  /** The current session's id: `$.session.id()`. */
  sessionId(): Promise<string>
  /** The current session's working directory: `$.session.root()`. */
  sessionRoot(): Promise<string>
  /** The time in milliseconds since the epoch: `$.clock.now()`. */
  now(): Promise<number>
  /** The stored nav, or `undefined` when none is stored (the current screen): `$.state.get`. */
  nav(): Promise<PaneNav | undefined>
  /** Stores the view for the pane to draw: `$.state.set`. Resolves whether the engine stored it. */
  writeView(view: PaneView): Promise<boolean>
  /** Stores the Browse view for the pane to draw: `$.state.set`. Resolves whether the engine stored it. */
  writeBrowse(view: BrowseView): Promise<boolean>
}

/** What `createPaneRefresher` works through. */
export interface PaneRefresherDeps {
  /** What the mod may ask of the engine. */
  readonly host: ModHost
  /** The pane's engine calls. */
  readonly pane: PaneHost
  /** Starts the mod; defaults to `startMod`. */
  readonly start?: (host: ModHost, session: { cwd: string }) => Promise<StartOutcome>
  /** Builds the services for a projects folder; defaults to `createPaneServices`. */
  readonly createServices?: (projectsRoot: string) => PaneServices
  /** Receives a code-only line for a failure the refresher survives; defaults to `console.error`. */
  readonly log?: (line: string) => void
}

/** Refreshes the pane's view. */
export interface PaneRefresher {
  /** Starts the mod unless it is already ready, remembering the outcome, and returns it. A later refresh reuses a failed outcome rather than probing again; this call retries a failed one, and joins a probe already in flight. */
  start(cwd: string): Promise<StartOutcome>
  /** Forgets what was last stored, so the next refresh writes its view even if it matches: call it when the stored view may be gone (after a `/clear`, or a render that found none). */
  forgetStored(): void
  /** Builds the view the nav calls for and stores it: the Browse screen on a list refresh only, otherwise a session's tree. Never rejects. */
  refresh(request: { readonly withList: boolean }): Promise<void>
  /** Whether this copy has stored a Browse view since the stored views were last forgotten. */
  isBrowseStored(): boolean
  /** Whether the Browse screen shows, or the last view shows a team, so the slow list tick is worth running. */
  wantsListTick(): boolean
}
