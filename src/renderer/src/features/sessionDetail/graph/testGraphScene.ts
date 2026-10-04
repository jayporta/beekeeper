import { render, screen } from '@testing-library/react'
import { createElement } from 'react'
import type { SessionRefDto } from '../../../../../shared/ipc/sessionRefDto'
import type { IpcResult } from '../../../../../shared/ipc/ipcResult'
import type { SessionDetailDto } from '../../../../../shared/ipc/sessionDetailDto'
import type { SessionListItemDto } from '../../../../../shared/ipc/sessionListDto'
import {
  testAgentRole,
  testLeadTeam,
  testRef,
  testSession,
  testTeammateTeam,
  testUsage
} from '@renderer/features/sessions/testSessionFixtures'
import { testRow } from '@renderer/features/sessions/testSessionRows'
import type { SessionRow } from '@renderer/features/sessions/sessionRow'
import { installBeekeeperApi, type TestBeekeeperApi } from '@renderer/testBeekeeperApi'
import { createQueryWrapper } from '@renderer/testQueryWrapper'
import { testDetail, testMeta, testNode, testReport, testTokenGroup } from '../testSessionDetail'
import { GraphCanvas } from './GraphCanvas'
import { useAgentGraph } from './useAgentGraph'

/** The viewed session in the test scene: a lead with two teammates, one in another folder. */
export const SCENE_SESSION = testRef(1)
/** The folder of the scene's second teammate. */
export const SCENE_OTHER_FOLDER = '-Users-a-other'

const lead = testSession(1, {
  model: 'claude-opus-5',
  team: testLeadTeam(
    [testRef(2), testRef(3, SCENE_OTHER_FOLDER)],
    testUsage({ missingTeammates: 0, teamListsTruncated: false })
  )
})
const writer = testSession(2, {
  role: testAgentRole('writer', 'code'),
  model: 'claude-sonnet-5',
  transcriptTokens: 2500,
  team: testTeammateTeam(SCENE_SESSION, true)
})
const tester = testSession(3, {
  projectDirName: SCENE_OTHER_FOLDER,
  role: testAgentRole('tester', 'code'),
  transcriptTokens: 900,
  team: testTeammateTeam(SCENE_SESSION)
})

/** The scene's sessions list: the lead, then its two teammates. */
export const SCENE_ITEMS: readonly SessionListItemDto[] = [lead, writer, tester]

/** The scene lead's detail: two subagents, `scout` and `reader`. */
export const SCENE_DETAIL = testDetail({
  lead: testReport({ tokenGroups: [testTokenGroup({ input: 1500 })] }),
  children: [
    testNode('a1', {
      meta: testMeta({ name: 'scout', agentType: 'Explore', model: 'claude-haiku-5' })
    }),
    testNode('a2', { meta: testMeta({ name: 'reader', agentType: 'Explore' }) })
  ],
  reports: { a1: testReport({ tokenGroups: [testTokenGroup({ output: 40 })] }) }
})

/** Props for {@link SceneGraph}. */
interface SceneGraphProps {
  readonly detail: SessionDetailDto
  readonly sessionRef: SessionRefDto
  readonly row: SessionRow | null
}

/** Builds the graph the way the session view does, and shows only its canvas. */
function SceneGraph(props: SceneGraphProps): React.JSX.Element {
  return createElement(GraphCanvas, { graph: useAgentGraph(props) })
}

/** What `renderGraphWith` shows. */
interface SceneOptions {
  /** The sessions list the lead's row is grouped from. Defaults to {@link SCENE_ITEMS}. */
  readonly items?: readonly SessionListItemDto[]
  /** The lead's detail. Defaults to {@link SCENE_DETAIL}. */
  readonly detail?: SessionDetailDto
  /** The row to pass, instead of the lead's row among `items`. `null` for a session the list doesn't hold. */
  readonly row?: SessionRow | null
  /** What `getSession` answers for a teammate's session, by session id: a result, or a promise to hold it back. Others answer with an empty detail. */
  readonly teammateDetails?: Readonly<
    Record<string, IpcResult<SessionDetailDto> | Promise<IpcResult<SessionDetailDto>>>
  >
}

/** A rendered scene and the stubbed API it loads teammates through. */
export type RenderedScene = ReturnType<typeof render> & { readonly api: TestBeekeeperApi }

/**
 * Renders the graph canvas of the scene's lead with its teammates' details
 * stubbed.
 *
 * @param options - What to show instead of the defaults.
 * @returns The render result and the stubbed API.
 */
export function renderGraphWith(options: SceneOptions = {}): RenderedScene {
  const { items = SCENE_ITEMS, detail = SCENE_DETAIL, teammateDetails = {} } = options
  const row = options.row === undefined ? testRow(1, items) : options.row
  const api = installBeekeeperApi({
    getSession: (_folder, sessionId) =>
      Promise.resolve(teammateDetails[sessionId] ?? { ok: true, value: testDetail() })
  })
  const rendered = render(createElement(SceneGraph, { detail, sessionRef: SCENE_SESSION, row }), {
    wrapper: createQueryWrapper()
  })
  return Object.assign(rendered, { api })
}

/**
 * Renders the scene's graph with a sessions list and a detail.
 *
 * @param items - The sessions list. Defaults to the scene's.
 * @param detail - The lead's detail. Defaults to the scene's.
 * @returns The render result and the stubbed API.
 */
export function renderGraph(
  items?: readonly SessionListItemDto[],
  detail?: SessionDetailDto
): RenderedScene {
  return renderGraphWith({ items, detail })
}

/** The node button whose accessible name matches. */
export function graphNode(name: RegExp | string): HTMLElement {
  return screen.getByRole('button', { name })
}

/** Every node button in the graph, in document order, leaving out the zoom controls. */
export function graphNodes(): HTMLElement[] {
  const controls = screen.queryByRole('group', { name: 'Zoom' })
  return screen
    .getAllByRole('button')
    .filter((button) => controls === null || !controls.contains(button))
}
