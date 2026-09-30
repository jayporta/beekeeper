import { render, type RenderResult } from '@testing-library/react'
import { resetFirstRun } from './features/firstRun/testFirstRunReset'
import { resetProjects } from './features/projects/testProjectsReset'
import App from './App'
import { createQueryWrapper } from './testQueryWrapper'

/** Returns every persisted store to a fresh install, between tests. */
export async function resetPersistedState(): Promise<void> {
  await resetFirstRun()
  await resetProjects()
}

/**
 * Renders the whole app with a fresh query client. Install the stub
 * `window.beekeeper` first.
 *
 * @returns The Testing Library render result.
 */
export function renderApp(): RenderResult {
  return render(<App />, { wrapper: createQueryWrapper() })
}
