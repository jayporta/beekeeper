import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { testRef, testSession } from '@renderer/features/sessions/testSessionFixtures'
import { installBeekeeperApi } from '@renderer/testBeekeeperApi'
import {
  createQueryWrapper,
  createTestQueryClient,
  refetchAndSettle
} from '@renderer/testQueryWrapper'
import { SessionDetailContent } from '../SessionDetailContent'
import { testDetail } from '../testSessionDetail'

const DIR = '-Users-a-repo'
const REF = testRef(1, DIR)

afterEach(() => {
  useNavigationStore.getState().reset()
})

describe('SessionDetailContent', () => {
  it('keeps the session on screen when a background refresh fails', async () => {
    const api = installBeekeeperApi({
      listSessions: () =>
        Promise.resolve({
          ok: true,
          value: [testSession(1, { projectDirName: DIR, title: 'Kept' })]
        }),
      getSession: () => Promise.resolve({ ok: true, value: testDetail() })
    })
    const client = createTestQueryClient()
    render(<SessionDetailContent sessionRef={REF} dirName={DIR} />, {
      wrapper: createQueryWrapper(client)
    })
    await screen.findByRole('heading', { level: 1, name: 'Kept' })

    api.getSession.mockResolvedValue({ ok: false, error: { code: 'unreadable' } })
    await refetchAndSettle(client, ['session', REF.projectDirName, REF.sessionId])

    expect(api.getSession).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('heading', { level: 1, name: 'Kept' })).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
