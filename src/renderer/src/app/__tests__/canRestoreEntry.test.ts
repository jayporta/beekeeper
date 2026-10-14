import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import type { IpcErrorCode } from '../../../../shared/ipc/ipcResult'
import type { SessionRefDto } from '../../../../shared/ipc/sessionRefDto'
import type { NavEntry } from '@renderer/features/navigation/state/navigationHistory'
import { sessionDetailQueryOptions } from '@renderer/features/sessionDetail/sessionDetailQuery'
import { testDetail } from '@renderer/features/sessionDetail/testSessionDetail'
import { testSession, testSessionId } from '@renderer/features/sessions/testSessionFixtures'
import { IpcCallError } from '@renderer/ipc/ipcCallError'
import { testProject } from '@renderer/testBeekeeperApi'
import { canRestoreEntry } from '../canRestoreEntry'

const ref: SessionRefDto = { projectDirName: 'a', sessionId: testSessionId(1) }
const projects = [testProject('a'), testProject('b')]

const sessionsOfA: NavEntry = {
  view: 'sessions',
  projectDirName: 'a',
  sessionRef: null,
  agent: null
}
const sessionEntry: NavEntry = {
  view: 'session',
  projectDirName: 'a',
  sessionRef: ref,
  agent: null
}
const overview: NavEntry = { view: 'overview', projectDirName: null, sessionRef: null, agent: null }

/** A client with nothing cached. */
function newClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

/** Caches the failure of loading `ref`'s detail with `code`, as a real load that failed would. */
async function failDetail(client: QueryClient, code: IpcErrorCode): Promise<void> {
  await client
    .fetchQuery({
      queryKey: sessionDetailQueryOptions(ref).queryKey,
      queryFn: () => Promise.reject(new IpcCallError(code))
    })
    .catch(() => undefined)
}

/** Caches a loaded detail for `ref`. */
function loadDetail(client: QueryClient): void {
  client.setQueryData(sessionDetailQueryOptions(ref).queryKey, testDetail())
}

/** Caches project `a`'s sessions list holding `ref`'s session, as an archived copy or a live one. */
function listSessions(client: QueryClient, archived: boolean): void {
  client.setQueryData(['sessions', 'a'], [testSession(1, { projectDirName: 'a', archived })])
}

/** Whether `entry` can be restored while `current` is on screen. */
function canRestore(
  entry: NavEntry,
  { current = overview, client = newClient(), listed = projects } = {}
): boolean {
  return canRestoreEntry(entry, { projects: listed, client, current })
}

describe('canRestoreEntry', () => {
  describe('the entry’s project', () => {
    it('accepts an entry whose project is listed', () => {
      expect(canRestore(sessionsOfA)).toBe(true)
    })

    it('rejects an entry whose project is no longer listed', () => {
      expect(canRestore(sessionsOfA, { listed: [testProject('b')] })).toBe(false)
    })

    it('accepts the overview whatever is listed, since it belongs to no project', () => {
      expect(canRestore(overview, { current: sessionsOfA, listed: [] })).toBe(true)
    })
  })

  describe('the place already on screen', () => {
    it('rejects an entry that is the place on screen', () => {
      expect(canRestore(sessionsOfA, { current: { ...sessionsOfA } })).toBe(false)
    })

    it('accepts an entry that differs only in the agent selected', () => {
      const withAgent: NavEntry = {
        ...sessionEntry,
        agent: { kind: 'teammate', ref: { ...ref, sessionId: 'other' } }
      }

      expect(canRestore(sessionEntry, { current: withAgent })).toBe(true)
    })

    it('accepts an entry that differs only in the project', () => {
      expect(canRestore(sessionsOfA, { current: { ...sessionsOfA, projectDirName: 'b' } })).toBe(
        true
      )
    })
  })

  describe('a session that no longer exists', () => {
    it('accepts a session whose detail load failed for another reason', async () => {
      const client = newClient()
      await failDetail(client, 'unreadable')
      client.setQueryData(['sessions', 'a'], [])

      expect(canRestore(sessionEntry, { client })).toBe(true)
    })

    it('accepts a session whose detail is loaded', () => {
      const client = newClient()
      loadDetail(client)

      expect(canRestore(sessionEntry, { client })).toBe(true)
    })

    it('accepts a session that was never loaded', () => {
      expect(canRestore(sessionEntry)).toBe(true)
    })

    it('accepts a session that is back after it was reported not found', async () => {
      const client = newClient()
      await failDetail(client, 'not-found')
      loadDetail(client)

      expect(canRestore(sessionEntry, { client })).toBe(true)
    })

    it('accepts a not-found session the folder’s list holds as an archived copy, which still has its summary page', async () => {
      const client = newClient()
      await failDetail(client, 'not-found')
      listSessions(client, true)

      expect(canRestore(sessionEntry, { client })).toBe(true)
    })

    it('rejects a not-found session the folder’s list holds only as a live one', async () => {
      const client = newClient()
      await failDetail(client, 'not-found')
      listSessions(client, false)

      expect(canRestore(sessionEntry, { client })).toBe(false)
    })

    it('rejects a session whose detail load reported not-found, when the folder’s list does not hold it', async () => {
      const client = newClient()
      await failDetail(client, 'not-found')
      client.setQueryData(['sessions', 'a'], [])

      expect(canRestore(sessionEntry, { client })).toBe(false)
    })

    it('accepts a not-found session when the folder’s list is not cached, since it may hold an archived copy', async () => {
      const client = newClient()
      await failDetail(client, 'not-found')

      expect(canRestore(sessionEntry, { client })).toBe(true)
    })

    it('checks only entries that show a session', async () => {
      const client = newClient()
      await failDetail(client, 'not-found')

      expect(canRestore(sessionsOfA, { client })).toBe(true)
    })
  })
})
