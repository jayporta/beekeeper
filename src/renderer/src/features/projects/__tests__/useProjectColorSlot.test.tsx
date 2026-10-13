import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { installBeekeeperApi, testProject } from '@renderer/testBeekeeperApi'
import { createQueryWrapper } from '@renderer/testQueryWrapper'
import { useProjectColorSlot } from '../useProjectColorSlot'
import { useProjects } from '../useProjects'

const ALPHA = '-Users-a-alpha'
const WORKTREE = '-Users-a-alpha--claude-worktrees-x'
const BETA = '-Users-a-beta'

function installProjects(): void {
  installBeekeeperApi({
    listProjects: () =>
      Promise.resolve({
        ok: true,
        value: [
          testProject(ALPHA),
          testProject(WORKTREE, { worktreeOf: ALPHA, worktreeName: 'x' }),
          testProject(BETA)
        ]
      })
  })
}

describe('useProjectColorSlot', () => {
  it('is null while the projects load', () => {
    installBeekeeperApi({ listProjects: () => new Promise(() => undefined) })

    const { result } = renderHook(() => useProjectColorSlot(ALPHA), {
      wrapper: createQueryWrapper()
    })

    expect(result.current).toBeNull()
  })

  it('gives each top-level project its sidebar position as a slot', async () => {
    installProjects()

    const { result } = renderHook(() => useProjectColorSlot(BETA), {
      wrapper: createQueryWrapper()
    })

    await waitFor(() => expect(result.current).toBe(2))
  })

  it("gives a worktree its parent's slot", async () => {
    installProjects()

    const { result } = renderHook(() => useProjectColorSlot(WORKTREE), {
      wrapper: createQueryWrapper()
    })

    await waitFor(() => expect(result.current).toBe(1))
  })

  it('is null for a folder that is not listed', async () => {
    installProjects()

    const { result } = renderHook(
      () => ({ slot: useProjectColorSlot('-Users-a-gone'), projects: useProjects() }),
      { wrapper: createQueryWrapper() }
    )

    await waitFor(() => expect(result.current.projects.data).toBeDefined())
    expect(result.current.slot).toBeNull()
  })
})
