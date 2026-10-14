import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { installBeekeeperApi, testProject } from '@renderer/testBeekeeperApi'
import { createQueryWrapper } from '@renderer/testQueryWrapper'
import { resetPersistedState } from '@renderer/testRenderApp'
import { useSelectedProject } from '../state/useSelectedProject'
import { useSelectedProjectDirName } from '../state/useSelectedProjectDirName'
import { useSelectedProjectStore } from '../state/useSelectedProjectStore'
import { useProjects } from '../useProjects'

afterEach(resetPersistedState)

/** Shows whether projects loaded, the project in effect, and its folder name, so a test can wait for them. */
function Harness(): React.JSX.Element {
  const { status } = useProjects()
  const project = useSelectedProject()
  const dirName = useSelectedProjectDirName()
  return (
    <p>{`${status} project:${project?.dirName ?? 'none'} label:${project?.label ?? 'none'} dir:${dirName ?? 'none'}`}</p>
  )
}

function listing(...projects: ReturnType<typeof testProject>[]): void {
  installBeekeeperApi({ listProjects: () => Promise.resolve({ ok: true, value: projects }) })
}

describe('useSelectedProject', () => {
  it('returns null while the projects load', () => {
    installBeekeeperApi({ listProjects: () => new Promise(() => undefined) })

    render(<Harness />, { wrapper: createQueryWrapper() })

    expect(screen.getByText('pending project:none label:none dir:none')).toBeTruthy()
  })

  it('returns the stored project when it is still listed', async () => {
    useSelectedProjectStore.setState({ selectedDirName: '-b' })
    listing(testProject('-a'), { ...testProject('-b'), label: 'Beta' })

    render(<Harness />, { wrapper: createQueryWrapper() })

    expect(await screen.findByText('success project:-b label:Beta dir:-b')).toBeTruthy()
  })
})
