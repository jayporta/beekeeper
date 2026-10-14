import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { BrowseView } from '../../browse/browseView'
import { Pane } from '../Pane'
import type { PaneNav } from '../../shared/paneNav'
import type { PaneView } from '../paneView'
import {
  findAll,
  installTestH,
  makeTestElements,
  removeTestH,
  textOf
} from '../../shared/testElements'
import { testPaneNode, testPaneView } from '../testPaneView'

const elements = makeTestElements()
const REF = { projectDirName: '-p', sessionId: 'browsed' }
const SESSION_NAV: PaneNav = { screen: 'session', ref: REF, backTo: '-p' }
const BROWSE: BrowseView = {
  status: 'ready',
  errorCode: null,
  projects: [{ dirName: '-p', label: 'alpha' }],
  projectDirName: '-p',
  rows: [],
  hiddenCount: 0,
  refreshedAtMs: 1
}
const lead = testPaneNode('lead', { kind: 'lead', name: 'Lead' })

function draw(options: { view?: PaneView; nav?: PaneNav; browse?: BrowseView }): unknown {
  return Pane({
    elements,
    view: options.view,
    selected: null,
    onSelect: vi.fn(),
    nav: options.nav,
    browse: options.browse,
    diffs: undefined,
    onNav: vi.fn(),
    onPickProject: vi.fn(),
    columns: undefined
  })
}

const buttonKeys = (tree: unknown): string[] =>
  findAll(tree, elements.Button).map((node) => String(node.props['key']))

describe('Pane screens', () => {
  beforeAll(installTestH)
  afterAll(removeTestH)

  it.each<[string, PaneView | undefined]>([
    ['loading', undefined],
    ['waiting', testPaneView(lead, { status: 'waiting', root: null })],
    ['an error', testPaneView(lead, { status: 'error', errorCode: 'not-found', root: null })],
    ['a tree', testPaneView(lead)]
  ])('draws the nav row first on the current screen, whatever the state is: %s', (_label, view) => {
    const tree = draw({ view })

    expect(buttonKeys(tree).slice(0, 2)).toEqual(['nav-current', 'nav-browse'])
    expect(textOf(tree).indexOf('This session')).toBeLessThan(textOf(tree).indexOf('beekeeper'))
  })

  it('draws the Browse screen under the nav row when the nav is browse', () => {
    const tree = draw({ nav: { screen: 'browse', projectDirName: null }, browse: BROWSE })

    expect(buttonKeys(tree)).toEqual(['nav-current', 'nav-browse'])
    expect(textOf(tree)).toContain('No sessions in this project')
  })

  it('draws the nav row over an error for a browsed session that is gone', () => {
    const view = testPaneView(lead, {
      sessionId: REF.sessionId,
      target: 'browsed',
      status: 'error',
      errorCode: 'not-found',
      root: null
    })

    const tree = draw({ view, nav: SESSION_NAV })

    expect(buttonKeys(tree)).toEqual(['nav-current', 'nav-browse'])
    expect(textOf(tree)).toContain("can't find this session's transcript")
  })

  it("draws the browsed session's tree when the view is of it", () => {
    const view = testPaneView(lead, { sessionId: REF.sessionId, target: 'browsed' })

    const tree = draw({ view, nav: SESSION_NAV })

    expect(buttonKeys(tree)).toContain('lead')
  })

  it('says in words that a browsed session is browsed, with its label', () => {
    const view = testPaneView(lead, { sessionId: REF.sessionId, target: 'browsed' })

    const text = textOf(draw({ view, nav: SESSION_NAV }))

    expect(text).toContain('beekeeper, browsing: Fix the bug')
  })

  it('says it is browsing while a browsed session loads', () => {
    expect(textOf(draw({ nav: SESSION_NAV }))).toContain('beekeeper, browsing')
  })

  it('does not say browsing on the current screen', () => {
    expect(textOf(draw({ view: testPaneView(lead) }))).not.toContain('browsing')
  })

  it.each<[string, PaneView, PaneNav | undefined]>([
    ["the current session's view while a session is browsed", testPaneView(lead), SESSION_NAV],
    [
      "another session's browsed view",
      testPaneView(lead, { sessionId: 'other', target: 'browsed' }),
      SESSION_NAV
    ],
    [
      'a browsed view while the current screen shows',
      testPaneView(lead, { sessionId: REF.sessionId, target: 'browsed' }),
      undefined
    ],
    [
      "a browsed view of the engine's own session after returning from it",
      testPaneView(lead, { target: 'browsed' }),
      { screen: 'current' }
    ]
  ])('says it is loading rather than draw %s', (_label, view, nav) => {
    const tree = draw({ view, nav })

    expect(textOf(tree)).toContain('Loading the session.')
    expect(buttonKeys(tree)).not.toContain('lead')
  })
})
