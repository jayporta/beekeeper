import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  findAll,
  installTestH,
  makeTestElements,
  removeTestH,
  textOf
} from '../../shared/testElements'
import type { BrowseRow, BrowseView } from '../browseView'
import { BrowseScreen } from '../BrowseScreen'

const BROWSE_NAV = { screen: 'browse', projectDirName: '-p' } as const

const row = (n: number, overrides: Partial<BrowseRow> = {}): BrowseRow => ({
  key: `-p/s${n}`,
  ref: { projectDirName: '-p', sessionId: `s${n}` },
  label: `Session ${n}`,
  depth: 0,
  tokens: 1234,
  tokensPartial: false,
  lastActiveMs: Date.UTC(2026, 0, 2, 12, 0),
  agents: '2 subagents',
  ...overrides
})

const view = (overrides: Partial<BrowseView> = {}): BrowseView => ({
  status: 'ready',
  errorCode: null,
  projects: [
    { dirName: '-p', label: 'alpha' },
    { dirName: '-q', label: 'beta' }
  ],
  projectDirName: '-p',
  rows: [row(1), row(2, { depth: 1 })],
  hiddenCount: 0,
  refreshedAtMs: 1,
  ...overrides
})

function draw(
  browse: BrowseView | undefined,
  options: {
    hasSelect?: boolean
    nav?: { screen: 'browse'; projectDirName: string | null }
    onNav?: () => void
    onPickProject?: (dirName: string) => void
    columns?: number
  } = {}
): { tree: unknown; elements: ReturnType<typeof makeTestElements> } {
  const elements = makeTestElements({ hasSelect: options.hasSelect ?? true })
  const tree = BrowseScreen({
    elements,
    browse,
    nav: options.nav ?? BROWSE_NAV,
    onNav: options.onNav ?? vi.fn(),
    onPickProject: options.onPickProject ?? vi.fn(),
    columns: options.columns
  })
  return { tree, elements }
}

describe('BrowseScreen', () => {
  beforeAll(installTestH)
  afterAll(removeTestH)

  describe.each(['terminal', 'desktop'])('on %s', () => {
    it.each([
      ['a ready view', view()],
      ['an empty project', view({ rows: [] })],
      ['no projects', view({ projects: [], projectDirName: null, rows: [] })],
      ['an error', view({ status: 'error', errorCode: 'unreadable', rows: [] })],
      ['loading', undefined]
    ])('has a title line that says it is Browse, for %s', (_label, browse) => {
      const { tree } = draw(browse, { nav: { screen: 'browse', projectDirName: null } })

      expect(textOf(tree)).toContain('beekeeper, browsing projects')
    })

    it('draws the projects in a Select with the picked one selected', () => {
      const { tree, elements } = draw(view())

      const [select] = findAll(tree, elements.Select)
      expect(select?.props).toMatchObject({
        key: 'beekeeper-project',
        label: 'Project',
        value: '-p',
        options: [
          { value: '-p', label: 'alpha' },
          { value: '-q', label: 'beta' }
        ]
      })
    })

    it('opens Browse on a project when one is picked', async () => {
      const onPickProject = vi.fn()
      const { tree, elements } = draw(view(), { onPickProject })

      const [select] = findAll(tree, elements.Select)
      await (select?.props['onSelect'] as (value: string) => Promise<void>)('-q')

      expect(onPickProject).toHaveBeenCalledWith('-q')
    })

    it('draws a pressable row per session, a teammate indented, with its facts in words', () => {
      const { tree, elements } = draw(view())

      const rows = findAll(tree, elements.Button)
      expect(rows.map((node) => node.props['key'])).toEqual(['browse:-p/s1', 'browse:-p/s2'])
      expect(textOf(rows[0])).toContain('Session 1')
      expect(textOf(rows[0])).toContain('1.2K tokens')
      expect(textOf(rows[0])).toContain('Jan 2, 2026')
      expect(textOf(rows[0])).toContain('2 subagents')
      expect(textOf(rows[1]).startsWith('  Teammate: Session 2')).toBe(true)
    })

    it('cuts a long label so the facts stay in view', () => {
      const long = row(1, { label: 'x'.repeat(500) })
      const { tree, elements } = draw(view({ rows: [long] }))

      const text = textOf(findAll(tree, elements.Button)[0])
      expect(text.length).toBeLessThan(150)
      expect(text).toContain('1.2K tokens')
      expect(text).toContain('…')
    })

    it("cuts a long label to the pane's width, keeping the facts and the teammate prefix", () => {
      const long = row(1, { label: 'x'.repeat(500), depth: 1 })
      const { tree, elements } = draw(view({ rows: [long] }), { columns: 90 })

      const text = textOf(findAll(tree, elements.Button)[0])
      expect(text.length).toBeLessThanOrEqual(90)
      expect(text).toContain('Teammate: ')
      expect(text).toContain('1.2K tokens')
      expect(text).toContain('2 subagents')
    })

    it('says it is loading while the stored view is a loading one, whatever the nav names', () => {
      const { tree, elements } = draw(view({ status: 'loading', rows: [] }), {
        nav: { screen: 'browse', projectDirName: null }
      })

      expect(textOf(tree)).toContain('Loading the sessions.')
      expect(findAll(tree, elements.Select)).toEqual([])
    })

    it('says a figure may be incomplete', () => {
      const { tree, elements } = draw(view({ rows: [row(1, { tokensPartial: true })] }))

      expect(textOf(findAll(tree, elements.Button)[0])).toContain('may be incomplete')
    })

    it('leaves out the facts a row does not have', () => {
      const bare = row(1, { tokens: null, lastActiveMs: null, agents: null })
      const { tree, elements } = draw(view({ rows: [bare] }))

      expect(textOf(findAll(tree, elements.Button)[0])).toBe('Session 1')
    })

    it('opens a pressed row as a session of its own folder, to return to the picked project', async () => {
      const onNav = vi.fn()
      const worktreeRow = row(1, {
        ref: { projectDirName: '-p--claude-worktrees-x', sessionId: 's1' }
      })
      const { tree, elements } = draw(view({ rows: [worktreeRow] }), { onNav })

      await (findAll(tree, elements.Button)[0]?.props['onPress'] as () => Promise<void>)()

      expect(onNav).toHaveBeenCalledWith({
        screen: 'session',
        ref: { projectDirName: '-p--claude-worktrees-x', sessionId: 's1' },
        backTo: '-p'
      })
    })

    it('says how many sessions the cap left out and where to see them', () => {
      const { tree } = draw(view({ hiddenCount: 5 }))

      expect(textOf(tree)).toContain('5 more sessions. The desktop app lists them all.')
    })

    it('says one more session in the singular', () => {
      const { tree } = draw(view({ hiddenCount: 1 }))

      expect(textOf(tree)).toContain('1 more session. The desktop app lists them all.')
    })

    it('says there are no sessions when the project has none, and draws no row', () => {
      const { tree, elements } = draw(view({ rows: [] }))

      expect(textOf(tree)).toContain('No sessions in this project')
      expect(findAll(tree, elements.Button)).toEqual([])
    })

    it('draws the rows, and no picker, while the projects are not listed yet for a picked project', () => {
      const { tree, elements } = draw(view({ projects: [] }))

      expect(textOf(tree)).toContain('Session 1')
      expect(textOf(tree)).not.toContain('No projects yet')
      expect(findAll(tree, elements.Select)).toEqual([])
    })

    it('says there are no projects, and draws no Select, when none are listed', () => {
      const { tree, elements } = draw(view({ projects: [], projectDirName: null, rows: [] }), {
        nav: { screen: 'browse', projectDirName: null }
      })

      expect(textOf(tree)).toContain('No projects yet')
      expect(findAll(tree, elements.Select)).toEqual([])
    })

    it('says it is loading before any view is stored', () => {
      expect(textOf(draw(undefined).tree)).toContain('Loading the sessions.')
    })

    it('says it is loading while the stored view is of another project than the nav names', () => {
      const { tree, elements } = draw(view(), {
        nav: { screen: 'browse', projectDirName: '-q' }
      })

      expect(textOf(tree)).toContain('Loading the sessions.')
      expect(findAll(tree, elements.Button)).toEqual([])
    })

    it('draws the stored view when the nav names no project yet', () => {
      const { tree } = draw(view(), { nav: { screen: 'browse', projectDirName: null } })

      expect(textOf(tree)).toContain('Session 1')
    })

    it('says why there is nothing, in a fixed line, when the view is an error', () => {
      const { tree } = draw(view({ status: 'error', errorCode: 'not-found', rows: [] }))

      expect(textOf(tree)).toContain("beekeeper can't find this session's transcript.")
    })

    it('keeps the project picker when listing the sessions failed, so another project can be picked', () => {
      const { tree, elements } = draw(view({ status: 'error', errorCode: 'unreadable', rows: [] }))

      expect(findAll(tree, elements.Select)).toHaveLength(1)
    })
  })

  describe('on a surface with no Select', () => {
    it('draws a Button per project instead, marking the picked one with a word', async () => {
      const onPickProject = vi.fn()
      const { tree, elements } = draw(view(), { hasSelect: false, onPickProject })

      const projects = findAll(tree, elements.Button).filter((node) =>
        String(node.props['key']).startsWith('project:')
      )
      expect(projects.map((node) => [node.props['key'], textOf(node)])).toEqual([
        ['project:-p', 'Selected: alpha'],
        ['project:-q', 'beta']
      ])
      await (projects[1]?.props['onPress'] as () => Promise<void>)()
      expect(onPickProject).toHaveBeenCalledWith('-q')
    })

    it('puts a word before the project Buttons and one before the sessions, so they can be told apart', () => {
      const { tree } = draw(view(), { hasSelect: false })

      const text = textOf(tree)
      expect(text).toContain('Project')
      expect(text.indexOf('Project')).toBeLessThan(text.indexOf('alpha'))
      expect(text.indexOf('Sessions')).toBeGreaterThan(text.indexOf('beta'))
      expect(text.indexOf('Sessions')).toBeLessThan(text.indexOf('Session 1'))
    })

    it('draws no project Buttons when there are no projects', () => {
      const { tree, elements } = draw(view({ projects: [], projectDirName: null, rows: [] }), {
        hasSelect: false,
        nav: { screen: 'browse', projectDirName: null }
      })

      expect(findAll(tree, elements.Button)).toEqual([])
      expect(textOf(tree)).toContain('No projects yet')
    })
  })
})
