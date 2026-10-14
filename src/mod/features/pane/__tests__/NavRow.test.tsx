import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { NavRow } from '../NavRow'
import type { PaneNav } from '../../shared/paneNav'
import {
  findAll,
  installTestH,
  makeTestElements,
  removeTestH,
  textOf
} from '../../shared/testElements'

const elements = makeTestElements()
const buttons = (tree: unknown): { key: unknown; text: string; press: () => unknown }[] =>
  findAll(tree, elements.Button).map((node) => ({
    key: node.props['key'],
    text: textOf(node),
    press: node.props['onPress'] as () => unknown
  }))

describe('NavRow', () => {
  beforeAll(installTestH)
  afterAll(removeTestH)

  it.each<[string, PaneNav, string[]]>([
    ['the current screen', { screen: 'current' }, ['nav-current', 'nav-browse']],
    [
      'the browse screen',
      { screen: 'browse', projectDirName: '-p' },
      ['nav-current', 'nav-browse']
    ],
    [
      'a browsed session',
      { screen: 'session', ref: { projectDirName: '-p', sessionId: 's' }, backTo: '-p' },
      ['nav-current', 'nav-browse']
    ]
  ])('has the right buttons on %s', (_label, nav, keys) => {
    const tree = NavRow({ elements, nav, onNav: vi.fn() })

    expect(buttons(tree).map((button) => button.key)).toEqual(keys)
  })

  it('marks the screen showing with a word, not a color', () => {
    const current = buttons(NavRow({ elements, nav: { screen: 'current' }, onNav: vi.fn() }))
    const browse = buttons(
      NavRow({ elements, nav: { screen: 'browse', projectDirName: null }, onNav: vi.fn() })
    )

    expect(current.map((button) => button.text)).toEqual(['This session (showing)', 'Browse'])
    expect(browse.map((button) => button.text)).toEqual(['This session', 'Browse (showing)'])
  })

  it('names where Browse goes on a browsed session, and does not mark it as showing', () => {
    const nav: PaneNav = {
      screen: 'session',
      ref: { projectDirName: '-p', sessionId: 's' },
      backTo: '-p'
    }

    const buttonsDrawn = buttons(NavRow({ elements, nav, onNav: vi.fn() }))

    expect(buttonsDrawn.map((button) => [button.key, button.text])).toEqual([
      ['nav-current', 'This session'],
      ['nav-browse', 'Browse: back to the session list']
    ])
  })

  it('opens Browse with no project from the current screen', async () => {
    const onNav = vi.fn()
    const [, browse] = buttons(NavRow({ elements, nav: { screen: 'current' }, onNav }))

    await browse?.press()

    expect(onNav).toHaveBeenCalledWith({ screen: 'browse', projectDirName: null })
  })

  it('returns to the project the session was opened from with Browse', async () => {
    const onNav = vi.fn()
    const nav: PaneNav = {
      screen: 'session',
      ref: { projectDirName: '-wt', sessionId: 's' },
      backTo: '-p'
    }
    const [, browse] = buttons(NavRow({ elements, nav, onNav }))

    await browse?.press()

    expect(onNav.mock.calls).toEqual([[{ screen: 'browse', projectDirName: '-p' }]])
  })

  it('returns to the current screen from This session', async () => {
    const onNav = vi.fn()
    const [current] = buttons(
      NavRow({ elements, nav: { screen: 'browse', projectDirName: '-p' }, onNav })
    )

    await current?.press()

    expect(onNav).toHaveBeenCalledWith({ screen: 'current' })
  })
})
