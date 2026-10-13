import { buildAgentGraph } from '../../../shared/agentGraph/buildAgentGraph'
import type { IpcErrorCode, IpcResult } from '../../../shared/ipc/ipcResult'
import {
  getSessionRequestSchema,
  listSessionsRequestSchema,
  type GetSessionRequest,
  type ListSessionsRequest
} from '../../../shared/ipc/requestSchemas'
import type { SessionDetailDto } from '../../../shared/ipc/sessionDetailDto'
import type { SessionListItemDto } from '../../../shared/ipc/sessionListDto'
import type { SessionRefDto } from '../../../shared/ipc/sessionRefDto'
import { findSessionRow } from '../../../shared/sessions/findSessionRow'
import { groupSessionRows } from '../../../shared/sessions/groupSessionRows'
import { shortId } from '../../../shared/sessions/sessionLabel'
import { emptyPaneView } from './emptyPaneView'
import { PANE_WORDS } from './paneWords'
import type { PaneView } from './paneView'
import { toPaneView } from './toPaneView'

/** The two service calls a refresh makes. */
export interface PaneServices {
  /** `listSessions` for a project folder. */
  listSessions(request: ListSessionsRequest): Promise<IpcResult<readonly SessionListItemDto[]>>
  /** `getSession` for one session. */
  getSession(request: GetSessionRequest): Promise<IpcResult<SessionDetailDto>>
}

/** What {@link refreshPane} needs. */
export interface RefreshPaneInput {
  /** The session to show. */
  readonly ref: SessionRefDto
  /** Whether to list the folder's sessions again, or reuse `lastItems`. */
  readonly withList: boolean
  /** The items the last list returned, or `null` when none has. */
  readonly lastItems: readonly SessionListItemDto[] | null
  /** The time to stamp the view with, in milliseconds since the epoch. */
  readonly nowMs: number
}

/** A refreshed view and the list items to pass to the next refresh. */
export interface RefreshedPane {
  /** The view to draw. */
  readonly view: PaneView
  /** The folder's items: fresh when the list ran and succeeded, otherwise the ones passed in. */
  readonly items: readonly SessionListItemDto[] | null
}

function errorView(input: RefreshPaneInput, code: IpcErrorCode): PaneView {
  return emptyPaneView({
    sessionId: input.ref.sessionId,
    status: 'error',
    errorCode: code,
    nowMs: input.nowMs
  })
}

async function build(services: PaneServices, input: RefreshPaneInput): Promise<RefreshedPane> {
  const { ref, withList, lastItems } = input
  const listRequest = listSessionsRequestSchema.safeParse({ projectDirName: ref.projectDirName })
  const getRequest = getSessionRequestSchema.safeParse({
    projectDirName: ref.projectDirName,
    sessionId: ref.sessionId
  })
  if (!listRequest.success || !getRequest.success) {
    return { view: errorView(input, 'invalid-request'), items: lastItems }
  }

  let items = lastItems
  if (withList) {
    const listed = await services.listSessions(listRequest.data)
    if (!listed.ok) return { view: errorView(input, listed.error.code), items: lastItems }
    items = listed.value
  }
  const detail = await services.getSession(getRequest.data)
  if (!detail.ok) return { view: errorView(input, detail.error.code), items }

  const rows = groupSessionRows(items ?? [], PANE_WORDS.label)
  const rootRow = findSessionRow(rows, ref)
  const root = buildAgentGraph({
    detail: detail.value,
    ref,
    rootItem: rootRow?.item ?? null,
    rootRow,
    words: PANE_WORDS.graph
  })
  const view = toPaneView({
    sessionId: ref.sessionId,
    root,
    rootItem: rootRow?.item ?? null,
    detail: detail.value,
    label: rootRow?.label.text ?? shortId(ref.sessionId),
    nowMs: input.nowMs
  })
  return { view, items }
}

/**
 * Builds the pane's view of one session from the same service calls the
 * desktop app makes and the shared agent graph. It never rejects: a failure
 * becomes an `error` view carrying a code only.
 *
 * @param services - The list and get calls.
 * @param input - The session, whether to list again, the last items and the time.
 * @returns The view and the items to keep for the next refresh.
 */
export async function refreshPane(
  services: PaneServices,
  input: RefreshPaneInput
): Promise<RefreshedPane> {
  try {
    return await build(services, input)
  } catch {
    return { view: errorView(input, 'internal'), items: input.lastItems }
  }
}
