import { describe, expect, it } from 'vitest'
import { blendOver, contrastRatio } from '../testContrast'
import { readTokenSchemes } from '../testTokens'

const schemes = readTokenSchemes(new URL('../tokens.css', import.meta.url))

const TEXT_TOKENS = ['--color-text', '--color-text-muted', '--color-meta', '--color-accent-strong']
const TEXT_GROUNDS = [
  '--color-bg',
  '--color-surface',
  '--color-surface-nested',
  '--color-accent-200'
]
const CONTROL_GROUNDS = ['--color-bg', '--color-surface']

/** The 4.5:1 text pairs, then the 3:1 pairs for a control's edge and the focus ring, as [foreground, background, minimum]. */
const PAIRS: readonly (readonly [string, string, number])[] = [
  ...TEXT_TOKENS.flatMap((fg) => TEXT_GROUNDS.map((bg) => [fg, bg, 4.5] as const)),
  ['--color-bg', '--color-accent-strong', 4.5],
  ...CONTROL_GROUNDS.map((bg) => ['--color-border-strong', bg, 3] as const),
  ...[...CONTROL_GROUNDS, '--color-accent-200'].map((bg) => ['--focus-ring-color', bg, 3] as const)
]

describe.each(Object.entries(schemes))('%s color scheme', (_scheme, tokens) => {
  it.each(PAIRS)('%s on %s is at least %s:1', (foreground, background, minimum) => {
    const fg = tokens[foreground]
    const bg = tokens[background]
    if (fg === undefined || bg === undefined)
      throw new Error(`Missing token: ${foreground} or ${background}`)

    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(minimum)
  })
})

describe.each(Object.entries(schemes))('%s color scheme graph edges', (_scheme, tokens) => {
  it('are at least 3:1 against the ground, text at the edge opacity (WCAG 1.4.11)', () => {
    const text = tokens['--color-text']
    const ground = tokens['--color-bg']
    const opacity = Number(tokens['--opacity-graph-edge'])
    if (text === undefined || ground === undefined || Number.isNaN(opacity))
      throw new Error('Missing token: --color-text, --color-bg or --opacity-graph-edge')

    expect(contrastRatio(blendOver(text, ground, opacity), ground)).toBeGreaterThanOrEqual(3)
  })
})

describe('blendOver', () => {
  it('is the foreground at full opacity and the background at none', () => {
    expect(blendOver('#102030', '#ffffff', 1)).toBe('#102030')
    expect(blendOver('#102030', '#ffffff', 0)).toBe('#ffffff')
  })

  it('lands halfway between the two at half opacity', () => {
    expect(blendOver('#000000', '#ffffff', 0.5)).toBe('#808080')
  })

  it('rejects a color that is not 6-digit hex', () => {
    expect(() => blendOver('red', '#ffffff', 0.5)).toThrow('Not a 6-digit hex color')
  })
})

describe('contrastRatio', () => {
  it('is 21 for black on white', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5)
  })

  it('is the same with the colors swapped', () => {
    expect(contrastRatio('#416180', '#f2f2f3')).toBeCloseTo(contrastRatio('#f2f2f3', '#416180'), 10)
  })

  it('rejects a color that is not 6-digit hex', () => {
    expect(() => contrastRatio('rgb(0 0 0)', '#ffffff')).toThrow('Not a 6-digit hex color')
  })
})
