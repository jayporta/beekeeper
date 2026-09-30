import { describe, expect, it } from 'vitest'
import { createQueryClient, PERSIST_MAX_AGE_MS } from '../queryClient'

describe('createQueryClient', () => {
  it('does not refetch on window focus or reconnect', () => {
    const { queries } = createQueryClient().getDefaultOptions()

    expect(queries?.refetchOnWindowFocus).toBe(false)
    expect(queries?.refetchOnReconnect).toBe(false)
  })

  it('keeps cached queries at least as long as the persister keeps them', () => {
    const { queries } = createQueryClient().getDefaultOptions()

    expect(queries?.gcTime).toBeGreaterThanOrEqual(PERSIST_MAX_AGE_MS)
  })
})
