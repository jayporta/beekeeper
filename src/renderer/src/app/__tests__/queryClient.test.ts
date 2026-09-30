import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { PERSIST_MAX_AGE_MS } from '../persistMaxAge'
import { createQueryClient } from '../queryClient'
import { PERSISTED_QUERY_ROOTS } from '../shouldPersistQuery'

const gcTimeOf = (client: QueryClient, queryKey: readonly unknown[]): number =>
  client.getQueryCache().build(client, { queryKey }).gcTime

describe('createQueryClient', () => {
  it('does not refetch on window focus or reconnect', () => {
    const { queries } = createQueryClient().getDefaultOptions()

    expect(queries?.refetchOnWindowFocus).toBe(false)
    expect(queries?.refetchOnReconnect).toBe(false)
  })

  it('leaves the default gcTime alone, so a query outside the persisted roots uses the stock one', () => {
    const client = createQueryClient()

    expect(client.getDefaultOptions().queries?.gcTime).toBeUndefined()
    expect(gcTimeOf(client, ['something-else', 'x'])).toBe(
      gcTimeOf(new QueryClient(), ['something-else', 'x'])
    )
    expect(gcTimeOf(client, ['something-else', 'x'])).not.toBe(PERSIST_MAX_AGE_MS)
  })

  it.each(PERSISTED_QUERY_ROOTS)('keeps a %s query as long as the persister keeps it', (root) => {
    expect(gcTimeOf(createQueryClient(), [root, 'x'])).toBe(PERSIST_MAX_AGE_MS)
  })
})
