import { act, renderHook, waitFor, type RenderHookResult } from '@testing-library/react'
import type { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { installBeekeeperApi, testProject } from '@renderer/testBeekeeperApi'
import { createQueryWrapper, createTestQueryClient } from '@renderer/testQueryWrapper'
import type { ProjectColorSlot } from '../projectColorSlot'
import { useProjectColorSlot } from '../useProjectColorSlot'

const A = testProject('-a')
const A_TREE = testProject('-a--claude-worktrees-x', {
  worktreeOf: '-a',
  worktreeName: 'x'
})
const B = testProject('-b')
const C = testProject('-c')

/** Renders the hook against a listing and waits until the projects have loaded. */
async function renderSlot(
  dirName: string | null,
  listing: ReturnType<typeof testProject>[]
): Promise<
  RenderHookResult<ProjectColorSlot | null, { name: string | null }> & { client: QueryClient }
> {
  installBeekeeperApi({ listProjects: () => Promise.resolve({ ok: true, value: listing }) })
  const client = createTestQueryClient()
  const view = renderHook(({ name }) => useProjectColorSlot(name), {
    initialProps: { name: dirName },
    wrapper: createQueryWrapper(client)
  })
  await waitFor(() => {
    expect(client.getQueryData(['projects'])).toBeDefined()
  })
  return { ...view, client }
}

describe('useProjectColorSlot', () => {
  it('is null while the projects load', () => {
    installBeekeeperApi({ listProjects: () => new Promise(() => undefined) })

    const { result } = renderHook(() => useProjectColorSlot('-a'), {
      wrapper: createQueryWrapper()
    })

    expect(result.current).toBeNull()
  })

  it('gives each top-level project the slot of its place in the sidebar', async () => {
    const first = await renderSlot('-a', [A, A_TREE, B])
    const second = await renderSlot('-b', [A, A_TREE, B])

    await waitFor(() => {
      expect(first.result.current).toBe(1)
    })
    await waitFor(() => {
      expect(second.result.current).toBe(2)
    })
  })

  it("gives a worktree its parent project's slot", async () => {
    const { result } = await renderSlot(A_TREE.dirName, [A, A_TREE, B])

    await waitFor(() => {
      expect(result.current).toBe(1)
    })
  })

  it.each([
    ['a folder that is not listed', '-zzz'],
    ['no folder', null]
  ])('is null for %s once the projects have loaded', async (_label, dirName) => {
    const { result, rerender } = await renderSlot('-a', [A, B])
    await waitFor(() => {
      expect(result.current).toBe(1)
    })

    rerender({ name: dirName })

    expect(result.current).toBeNull()
  })

  it('follows the current sidebar order when a new project appears at the top', async () => {
    const { result, client } = await renderSlot('-a', [A, B])
    await waitFor(() => {
      expect(result.current).toBe(1)
    })

    act(() => {
      client.setQueryData(['projects'], [C, A, B])
    })

    await waitFor(() => {
      expect(result.current).toBe(2)
    })
  })
})
