import type { QueryClient } from '@tanstack/react-query'
import { act, type RenderResult } from '@testing-library/react'
import { PERSISTED_STORES, type PersistedStoreHandle } from '@renderer/testPersistedStores'
import { createTestQueryClient } from '@renderer/testQueryWrapper'
import { renderApp } from '@renderer/testRenderApp'

/** Resolves when the store's load from storage is over: at once when it already is. */
function hydrated({ persist }: PersistedStoreHandle): Promise<void> {
  return new Promise((resolve) => {
    if (persist.hasHydrated()) {
      resolve()
      return
    }
    const stopListening = persist.onFinishHydration(() => {
      stopListening()
      resolve()
    })
  })
}

/** Resolves when the client has nothing in flight: at once when it already is idle. */
function idle(client: QueryClient): Promise<void> {
  return new Promise((resolve) => {
    if (client.isFetching() === 0) {
      resolve()
      return
    }
    const stopListening = client.getQueryCache().subscribe(() => {
      if (client.isFetching() !== 0) return
      stopListening()
      resolve()
    })
  })
}

/**
 * Loads every persisted store from storage and waits for the loads to finish,
 * so a test starts with storage already opened. Call it in `beforeEach`,
 * after setting any store state the test needs.
 */
export async function hydratePersistedStores(): Promise<void> {
  await Promise.all(PERSISTED_STORES.map(async ({ persist }) => persist.rehydrate()))
}

/**
 * Waits until the app has read its persisted stores and every query it started
 * has settled, including the queries that only start once an earlier one
 * returns (sessions after projects). It waits on those events, and on one
 * `setTimeout(0)` per round to let TanStack deliver a result, so it holds under
 * load. Under fake timers it holds only when they advance on their own
 * (`shouldAdvanceTime: true`): with plain `vi.useFakeTimers()` that timer never
 * fires and it hangs. A query that never settles keeps it waiting until the
 * test times out.
 *
 * @param client - The client the app renders with.
 */
async function waitForAppReady(client: QueryClient): Promise<void> {
  await act(async () => {
    await Promise.all(PERSISTED_STORES.map(hydrated))
  })
  // TanStack hands a result to the components on a timer, and leaving an `act` renders what that
  // result unlocked, which starts the next queries. A timer queued now runs after the one
  // that delivers the result, so the loop checks for in-flight queries only once both are done.
  do {
    await act(async () => {
      await idle(client)
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  } while (client.isFetching() > 0)
}

/**
 * Renders the whole app and waits until it is ready (see {@link waitForAppReady}).
 * Install the stub `window.beekeeper` first.
 *
 * @param client - The client to provide. Pass the one a test drives, or omit it for a fresh one.
 * @returns The Testing Library render result.
 */
export async function renderAppReady(
  client: QueryClient = createTestQueryClient()
): Promise<RenderResult> {
  const result = renderApp(client)
  await waitForAppReady(client)
  return result
}
