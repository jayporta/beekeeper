import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

interface QueryWrapperProps {
  readonly children: React.ReactNode
}

/**
 * Creates a component that provides a fresh query client with retries off, so
 * a failed query settles at once and tests don't share a cache.
 *
 * @returns A wrapper to pass to `render` as `{ wrapper }`.
 */
export function createQueryWrapper(): (props: QueryWrapperProps) => React.JSX.Element {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function QueryWrapper({ children }: QueryWrapperProps) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}
