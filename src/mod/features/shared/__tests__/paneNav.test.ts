import { describe, expect, it } from 'vitest'
import { testRef } from '../../../../shared/sessions/testSessionFixtures'
import { targetOf, type PaneNav } from '../paneNav'

const CURRENT = testRef(1)
const BROWSED = testRef(2, '-other')

describe('targetOf', () => {
  it.each<[string, PaneNav | undefined]>([
    ['no nav', undefined],
    ['the current screen', { screen: 'current' }],
    ['the browse screen', { screen: 'browse', projectDirName: '-p' }]
  ])('is the current session for %s', (_label, nav) => {
    expect(targetOf(nav, CURRENT)).toEqual({ ref: CURRENT, target: 'current' })
  })

  it('is the browsed session for the session screen', () => {
    const nav: PaneNav = { screen: 'session', ref: BROWSED, backTo: '-other' }

    expect(targetOf(nav, CURRENT)).toEqual({ ref: BROWSED, target: 'browsed' })
  })
})
