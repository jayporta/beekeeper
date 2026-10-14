import { describe, expect, it } from 'vitest'
import type { ProjectDto } from '../../../../shared/ipc/projectDto'
import { testAgentCountWords } from '../../../../shared/sessions/testAgentCountWords'
import { testSessionLabelWords } from '../../../../shared/sessions/testSessionLabelWords'
import { testSession } from '../../../../shared/sessions/testSessionFixtures'
import { testProject } from '../../../../shared/projects/testProject'
import { testPaneServices } from '../../shared/testPaneServices'
import type { BrowseView } from '../browseView'
import { refreshBrowse, type RefreshBrowseInput } from '../refreshBrowse'

const WORDS = { label: testSessionLabelWords, agentCount: testAgentCountWords }
const PROJECTS: ProjectDto[] = [
  { ...testProject('-a'), label: 'alpha' },
  { ...testProject('-b'), label: 'beta' }
]

function run(
  services: ReturnType<typeof testPaneServices>,
  input: Partial<RefreshBrowseInput> = {}
): Promise<{ written: BrowseView[]; result: Awaited<ReturnType<typeof refreshBrowse>> }> {
  const written: BrowseView[] = []
  return refreshBrowse(services, {
    projectDirName: '-a',
    currentFolder: null,
    withProjects: false,
    lastProjects: PROJECTS,
    nowMs: 5,
    words: WORDS,
    write: async (view) => {
      written.push(view)
      return true
    },
    ...input
  }).then((result) => ({ written, result }))
}

const ok = <T>(value: T): { ok: true; value: T } => ({ ok: true, value })

describe('refreshBrowse', () => {
  it("stores the picked project's sessions before it lists the projects", async () => {
    const services = testPaneServices({
      list: ok([testSession(1, { title: 'One' })]),
      get: ok(null as never),
      projects: ok(PROJECTS)
    })
    const order: string[] = []
    const { listSessions, listProjects } = services
    services.listSessions = async (r) => (order.push('sessions'), listSessions(r))
    services.listProjects = async () => (order.push('projects'), listProjects())

    const { written } = await run(services, { withProjects: true, lastProjects: null })

    expect(order).toEqual(['sessions', 'projects'])
    expect(written.map((view) => [view.status, view.projects.length])).toEqual([
      ['ready', 0],
      ['ready', 2]
    ])
    expect(written[0]?.rows[0]?.label).toBe('One')
  })

  it('does not list the projects unless asked', async () => {
    const services = testPaneServices({ list: ok([]), get: ok(null as never) })

    await run(services, { withProjects: false })

    expect(services.projectCalls).toBe(0)
    expect(services.listedFolders).toEqual(['-a'])
  })

  it("picks the current session's folder when no project is picked and it is listed", async () => {
    const services = testPaneServices({ list: ok([]), get: ok(null as never) })

    const { written, result } = await run(services, {
      projectDirName: null,
      currentFolder: '-b'
    })

    expect(services.listedFolders).toEqual(['-b'])
    expect(written[0]?.projectDirName).toBe('-b')
    expect(result.projectDirName).toBe('-b')
  })

  it("picks the first parent project when the current session's folder is not listed", async () => {
    const services = testPaneServices({ list: ok([]), get: ok(null as never) })

    await run(services, { projectDirName: null, currentFolder: '-gone' })

    expect(services.listedFolders).toEqual(['-a'])
  })

  it('lists the projects first when none is known and nothing is picked', async () => {
    const services = testPaneServices({
      list: ok([]),
      get: ok(null as never),
      projects: ok(PROJECTS)
    })

    const { result } = await run(services, {
      projectDirName: null,
      currentFolder: '-b',
      lastProjects: null
    })

    expect(services.projectCalls).toBe(1)
    expect(services.listedFolders).toEqual(['-b'])
    expect(result.projects).toEqual(PROJECTS)
  })

  it('stores an empty ready view when there are no projects', async () => {
    const services = testPaneServices({
      list: ok([]),
      get: ok(null as never),
      projects: ok([])
    })

    const { written } = await run(services, {
      projectDirName: null,
      currentFolder: null,
      lastProjects: null
    })

    expect(services.listCalls).toBe(0)
    expect(written).toHaveLength(1)
    expect(written[0]).toMatchObject({
      status: 'ready',
      projects: [],
      projectDirName: null,
      rows: []
    })
  })

  it('stores an error view with a code only when the sessions cannot be listed', async () => {
    const services = testPaneServices({
      list: { ok: false, error: { code: 'not-found' } },
      get: ok(null as never)
    })

    const { written } = await run(services)

    expect(written).toHaveLength(1)
    expect(written[0]).toMatchObject({
      status: 'error',
      errorCode: 'not-found',
      projectDirName: '-a'
    })
  })

  it('stores an invalid-request error without calling a service for a folder name the schema refuses', async () => {
    const services = testPaneServices({ list: ok([]), get: ok(null as never) })

    const { written } = await run(services, { projectDirName: '-bad\\name' })

    expect(services.listCalls).toBe(0)
    expect(written[0]).toMatchObject({ status: 'error', errorCode: 'invalid-request' })
  })

  it('stores an internal error, without the message, when a service throws', async () => {
    const services = testPaneServices({
      list: new Error('secret /home/u/x'),
      get: ok(null as never)
    })

    const { written } = await run(services)

    expect(written[0]).toMatchObject({ status: 'error', errorCode: 'internal' })
    expect(JSON.stringify(written[0])).not.toContain('secret')
  })

  it('does not reject when storing the view throws', async () => {
    const services = testPaneServices({ list: ok([]), get: ok(null as never) })

    await expect(
      refreshBrowse(services, {
        projectDirName: '-a',
        currentFolder: null,
        withProjects: false,
        lastProjects: PROJECTS,
        nowMs: 1,
        words: WORDS,
        write: async () => {
          throw new Error('nope')
        }
      })
    ).resolves.toBeDefined()
  })

  it('lists the projects again when the known list is empty and nothing is picked', async () => {
    const services = testPaneServices({
      list: ok([]),
      get: ok(null as never),
      projects: ok(PROJECTS)
    })

    const { result } = await run(services, {
      projectDirName: null,
      currentFolder: '-b',
      lastProjects: []
    })

    expect(services.projectCalls).toBe(1)
    expect(services.listedFolders).toEqual(['-b'])
    expect(result.projects).toEqual(PROJECTS)
  })

  it('keeps the rows and the projects, and stores no error, when relisting the projects fails', async () => {
    const services = testPaneServices({
      list: ok([testSession(1, { title: 'One' })]),
      get: ok(null as never),
      projects: { ok: false, error: { code: 'unreadable' } }
    })

    const { written, result } = await run(services, { withProjects: true })

    expect(written).toHaveLength(1)
    expect(written[0]).toMatchObject({ status: 'ready' })
    expect(written[0]?.rows).toHaveLength(1)
    expect(result.projects).toEqual(PROJECTS)
  })

  it('lists the projects when none are known, even for a picked project and without being asked', async () => {
    const services = testPaneServices({
      list: ok([testSession(1, { title: 'One' })]),
      get: ok(null as never),
      projects: ok(PROJECTS)
    })

    const { written, result } = await run(services, { withProjects: false, lastProjects: null })

    expect(services.projectCalls).toBe(1)
    expect(written.at(-1)?.projects).toHaveLength(2)
    expect(result.projects).toEqual(PROJECTS)
  })
})
