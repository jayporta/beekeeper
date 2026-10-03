import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { installBeekeeperApi, testProject } from '@renderer/testBeekeeperApi'
import { createQueryWrapper } from '@renderer/testQueryWrapper'
import { resetPersistedState } from '@renderer/testRenderApp'
import { useSelectedProject } from '../state/useSelectedProject'
import { useSelectedProjectDirName } from '../state/useSelectedProjectDirName'
import { useSelectedProjectStore } from '../state/useSelectedProjectStore'

afterEach(resetPersistedState)

/** Shows the project in effect and its folder name, so a test can wait for them. */
function Harness(): React.JSX.Element {
  const project = useSelectedProject()
  const dirName = useSelectedProjectDirName()
  return (
    <p>{`project:${project?.dirName ?? 'none'} label:${project?.label ?? 'none'} dir:${dirName ?? 'none'}`}</p>
  )
}

function listing(...projects: ReturnType<typeof testProject>[]): void {
  installBeekeeperApi({ listProjects: () => Promise.resolve({ ok: true, value: projects }) })
}

describe('useSelectedProject', () => {
  it('returns null while the projects load', () => {
    installBeekeeperApi({ listProjects: () => new Promise(() => undefined) })

    render(<Harness />, { wrapper: createQueryWrapper() })

    expect(screen.getByText('project:none label:none dir:none')).toBeTruthy()
  })

  it('returns the first parent project when nothing is stored', async () => {
    listing({ ...testProject('-a'), label: 'Alpha' }, testProject('-b'))

    render(<Harness />, { wrapper: createQueryWrapper() })

    expect(await screen.findByText('project:-a label:Alpha dir:-a')).toBeTruthy()
  })

  it('returns the stored project when it is still listed', async () => {
    useSelectedProjectStore.setState({ selectedDirName: '-b' })
    listing(testProject('-a'), { ...testProject('-b'), label: 'Beta' })

    render(<Harness />, { wrapper: createQueryWrapper() })

    expect(await screen.findByText('project:-b label:Beta dir:-b')).toBeTruthy()
  })

  it('falls back to the first parent project when the stored one is gone', async () => {
    useSelectedProjectStore.setState({ selectedDirName: '-gone' })
    listing(testProject('-a'))

    render(<Harness />, { wrapper: createQueryWrapper() })

    expect(await screen.findByText('project:-a label:none dir:-a')).toBeTruthy()
  })

  it('returns null when there are no projects', async () => {
    listing()
    render(<Harness />, { wrapper: createQueryWrapper() })

    expect(await screen.findByText('project:none label:none dir:none')).toBeTruthy()
  })
})
