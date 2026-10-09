import type { QueryClient } from '@tanstack/react-query'
import { act, type RenderResult } from '@testing-library/react'
import { useFirstRunStore } from '@renderer/features/firstRun/state/useFirstRunStore'
import { useSelectedProjectStore } from '@renderer/features/projects/state/useSelectedProjectStore'
import { createTestQueryClient } from '@renderer/testQueryWrapper'
import { renderApp } from '@renderer/testRenderApp'

/** The part of a store's `persist` API that loads it from storage and reports when the load is over. */
interface HydrationSource {
  /** Loads the store from storage. */
  rehydrate: () => Promise<void> | void
  /** Whether the latest load from storage has finished. */
  hasHydrated: () => boolean
  /** Calls `listener` once the load in progress finishes, and returns a function that stops listening. */
  onFinishHydration: (listener: () => void) => () => void
}

/** Every persisted store the app waits on before it shows anything. */
const PERSISTED_STORES: readonly { readonly persist: HydrationSource }[] = [
  useFirstRunStore,
  useSelectedProjectStore
]

/** Resolves when the store's load from storage is over: at once when it already is. */
function hydrated({ persist }: { readonly persist: HydrationSource }): Promise<void> {
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
 * returns (sessions after projects). It waits on those events, not on a clock,
 * so it holds under load and under fake timers. A query that never settles
 * keeps it waiting until the test times out.
 *
 * @param client - The client the app renders with.
 */
export async function waitForAppReady(client: QueryClient): Promise<void> {
  await act(async () => {
    await Promise.all(PERSISTED_STORES.map(hydrated))
  })
  // Leaving an `act` renders what the last result unlocked, which starts the next queries.
  while (client.isFetching() > 0) {
    await act(async () => {
      await idle(client)
    })
  }
}

/**
 * Renders the whole app and waits until it is ready (see {@link waitForAppReady}).
 * Install the stub `window.beekeeper` first. TanStack hands a settled query's
 * result to the screen on a timer, so a `findBy` query still checks the screen
 * once after this returns.
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
