import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useFirstRunStore } from '@renderer/features/firstRun/state/useFirstRunStore'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { testDetail } from '@renderer/features/sessionDetail/testSessionDetail'
import { testSession } from '@renderer/features/sessions/testSessionFixtures'
import { hydratePersistedStores, renderAppReady } from '@renderer/testAppReady'
import { installBeekeeperApi, testProject } from '@renderer/testBeekeeperApi'
import { resetPersistedState } from '@renderer/testRenderApp'
import { createTestQueryClient } from '@renderer/testQueryWrapper'

const DIR = '-Users-a-repo'

beforeEach(async () => {
  useFirstRunStore.setState({ dismissed: true })
  await hydratePersistedStores()
})

afterEach(async () => {
  useNavigationStore.getState().reset()
  await resetPersistedState()
})

describe('renderAppReady', () => {
  it('returns after the sessions query, which starts only once the projects query returns, has settled', async () => {
    const api = installBeekeeperApi({
      listProjects: () => Promise.resolve({ ok: true, value: [testProject(DIR)] }),
      listSessions: () =>
        Promise.resolve({ ok: true, value: [testSession(1, { projectDirName: DIR })] }),
      getSession: () => Promise.resolve({ ok: true, value: testDetail() })
    })
    const client = createTestQueryClient()

    await renderAppReady(client)

    expect(api.listSessions).toHaveBeenCalledTimes(1)
    expect(client.getQueryState(['sessions', DIR])?.status).toBe('success')
  })
})
