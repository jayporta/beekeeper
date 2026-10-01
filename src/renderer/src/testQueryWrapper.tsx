import { QueryClientProvider, type QueryClient, type QueryKey } from '@tanstack/react-query'
import { act } from '@testing-library/react'
import { createQueryClient } from '@renderer/app/queryClient'

interface QueryWrapperProps {
  readonly children: React.ReactNode
}

/**
 * Creates a query client with the app's real defaults, including its retry
 * rule, except that a retry waits no time, so a failure that is retried
 * settles quickly.
 *
 * @returns A fresh client.
 */
export function createTestQueryClient(): QueryClient {
  const client = createQueryClient()
  client.setDefaultOptions({
    queries: { ...client.getDefaultOptions().queries, retryDelay: 0 }
  })
  return client
}

/**
 * Creates a component that provides a query client, so tests don't share a cache.
 *
 * @param client - The client to provide. A fresh {@link createTestQueryClient} when omitted.
 * @returns A wrapper to pass to `render` as `{ wrapper }`.
 */
export function createQueryWrapper(
  client: QueryClient = createTestQueryClient()
): (props: QueryWrapperProps) => React.JSX.Element {
  return function QueryWrapper({ children }: QueryWrapperProps) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

/**
 * Refetches a query and waits until the components reading it have rendered the
 * result. TanStack delivers a query's update to its observers on a timer, so
 * a test that checks the screen straight after the refetch would see the old one.
 *
 * @param client - The client the components use.
 * @param queryKey - The key of the query to refetch.
 */
export async function refetchAndSettle(client: QueryClient, queryKey: QueryKey): Promise<void> {
  await act(async () => {
    await client.invalidateQueries({ queryKey })
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}
