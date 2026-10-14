import {
  queryOptions,
  type QueryKeyWithDataTag,
  type UnusedSkipTokenOptions
} from '@tanstack/react-query'
import type { SessionListItemDto } from '../../../../shared/ipc/sessionListDto'
import { unwrapIpcResult } from '@renderer/ipc/unwrapIpcResult'

/**
 * The first element of a session list's query key, and the root the rules
 * that cover every session list match on. It is part of the persisted cache's
 * format, so its value must not change.
 */
export const SESSIONS_QUERY_ROOT = 'sessions'

/** The list a session list query holds. */
type SessionList = readonly SessionListItemDto[]

/** The options of a session list query, whose key carries the type of the list it holds. */
type SessionsQueryOptions = UnusedSkipTokenOptions<SessionList, Error, SessionList, string[]> &
  QueryKeyWithDataTag<string[], SessionList, Error>

/**
 * The query that loads one project's sessions. Every reader of a session list
 * takes its key from here, so `getQueryData(sessionsQueryOptions(dirName).queryKey)`
 * is typed as the list.
 *
 * @param dirName - A folder name from the project list.
 * @returns The query options.
 */
export function sessionsQueryOptions(dirName: string): SessionsQueryOptions {
  return queryOptions({
    queryKey: [SESSIONS_QUERY_ROOT, dirName],
    queryFn: async () => unwrapIpcResult(await window.beekeeper.listSessions(dirName))
  })
}
