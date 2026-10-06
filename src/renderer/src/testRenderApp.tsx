import type { QueryClient } from '@tanstack/react-query'
import { render, type RenderResult } from '@testing-library/react'
import App from '@renderer/App'
import { resetFirstRun } from '@renderer/features/firstRun/testFirstRunReset'
import { resetProjects } from '@renderer/features/projects/testProjectsReset'
import { createQueryWrapper } from '@renderer/testQueryWrapper'

/** Returns every persisted store to a fresh install, between tests. */
export async function resetPersistedState(): Promise<void> {
  await resetFirstRun()
  await resetProjects()
}

/**
 * Renders the whole app with a query client. Install the stub
 * `window.beekeeper` first.
 *
 * @param client - The client to provide, for a test that drives its queries. A fresh one when omitted.
 * @returns The Testing Library render result.
 */
export function renderApp(client?: QueryClient): RenderResult {
  return render(<App />, { wrapper: createQueryWrapper(client) })
}
