import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PERSIST_MAX_AGE_MS } from '@renderer/app/persistMaxAge'
import { createQueryClient } from '@renderer/app/queryClient'
import { installBeekeeperApi } from '@renderer/testBeekeeperApi'
import { SESSIONS_GC_TIME_MS } from '../sessionsGcTime'
import { useSessions } from '../useSessions'

function render(client: QueryClient): ReturnType<typeof renderHook> {
  installBeekeeperApi({ listSessions: () => Promise.resolve({ ok: true, value: [] }) })
  return renderHook(() => useSessions('-p'), {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
  })
}

describe('useSessions cache lifetime', () => {
  it('keeps a session list in the cache only briefly, shorter than the persisted maximum age', async () => {
    const client = createQueryClient()
    const { result } = render(client)
    await waitFor(() => {
      expect((result.current as { isSuccess: boolean }).isSuccess).toBe(true)
    })

    const query = client.getQueryCache().find({ queryKey: ['sessions', '-p'] })

    expect(query?.gcTime).toBe(SESSIONS_GC_TIME_MS)
    expect(SESSIONS_GC_TIME_MS).toBeLessThan(PERSIST_MAX_AGE_MS)
  })
})
