import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from '@renderer/App'
import { useFirstRunStore } from '@renderer/features/firstRun/state/useFirstRunStore'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { testRef, testSession } from '@renderer/features/sessions/testSessionFixtures'
import { installBeekeeperApi, testProject } from '@renderer/testBeekeeperApi'
import { createQueryWrapper, createTestQueryClient } from '@renderer/testQueryWrapper'
import { resetPersistedState } from '@renderer/testRenderApp'

const GONE = '-Users-a-gone'
const FALLBACK = '-Users-a-fallback'

beforeEach(() => {
  useFirstRunStore.setState({ dismissed: true })
})

afterEach(async () => {
  useNavigationStore.getState().reset()
  await resetPersistedState()
})

/**
 * Opens a session of the project in effect (`GONE`, the first parent) whose
 * folder then proves gone: its list reports not-found, and the project list
 * that follows drops it, so `FALLBACK` takes over with its list already cached
 * and fresh. Resolves once navigation has left the view, with what the page
 * mounted on the way: any alert, and any "Session not found" message.
 */
async function openSessionOfFolderThatGoes(): Promise<string[]> {
  let goneReported = false
  installBeekeeperApi({
    listProjects: () =>
      Promise.resolve({
        ok: true,
        value: goneReported ? [testProject(FALLBACK)] : [testProject(GONE), testProject(FALLBACK)]
      }),
    listSessions: (dirName) => {
      if (dirName !== GONE) return Promise.resolve({ ok: true, value: [] })
      goneReported = true
      return Promise.resolve({ ok: false, error: { code: 'not-found' } })
    },
    getSession: () => Promise.resolve({ ok: false, error: { code: 'not-found' } })
  })
  const client = createTestQueryClient()
  client.setQueryData(
    ['sessions', FALLBACK],
    [testSession(3, { projectDirName: FALLBACK, title: 'Cached' })]
  )
  useNavigationStore.getState().showSession(testRef(1, GONE))
  const mounted: string[] = []
  const observer = new MutationObserver((records) => {
    for (const { addedNodes } of records) {
      for (const node of addedNodes) {
        if (!(node instanceof Element)) continue
        if (node.matches('[role="alert"]')) mounted.push('alert')
        if (node.textContent.includes('Session not found')) mounted.push('not found')
      }
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })

  render(<App />, { wrapper: createQueryWrapper(client) })
  await waitFor(() => {
    expect(useNavigationStore.getState().view).toBe('sessions')
  })
  await screen.findByRole('heading', { name: FALLBACK })
  observer.disconnect()
  return mounted
}

describe('SessionDetailView when its project’s folder is gone', () => {
  it('mounts no alert and no not-found message, even for one render, as the fallback project takes over', async () => {
    expect(await openSessionOfFolderThatGoes()).toEqual([])
  })
})
