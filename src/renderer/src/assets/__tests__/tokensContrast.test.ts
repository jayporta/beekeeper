import { describe, expect, it } from 'vitest'
import { apcaContrast, blendOver, contrastRatio } from '../testContrast'
import { readTokenSchemes, type TokenValues } from '../testTokens'

const schemes = readTokenSchemes(new URL('../tokens.css', import.meta.url))

/** The minimum absolute APCA Lc for body text, and for secondary text, accent text and diff lines. */
const LC_TEXT = 90
const LC_SECONDARY = 75

const TEXT_TOKENS = ['--color-text', '--color-text-muted', '--color-accent-strong']
/** The WCAG 2 ground tokens text sits on. */
const WCAG_GROUNDS = ['--color-bg', '--color-surface', '--color-surface-header', '--color-selected']
const CONTROL_GROUNDS = ['--color-bg', '--color-surface']

function token(tokens: TokenValues, name: string): string {
  const value = tokens[name]
  if (value === undefined) throw new Error(`Missing token: ${name}`)
  return value
}

/** Every ground text can sit on, as [label, hex]: the plain grounds, hover tints, and two tints stacked. */
function textGrounds(tokens: TokenValues): readonly (readonly [string, string])[] {
  const text = token(tokens, '--color-text')
  const opacity = Number(token(tokens, '--opacity-hover'))
  if (Number.isNaN(opacity)) throw new Error('--opacity-hover is not a number')
  const bg = token(tokens, '--color-bg')
  const surface = token(tokens, '--color-surface')
  const hoverOver = (ground: string): string => blendOver(text, ground, opacity)
  return [
    ['--color-bg', bg],
    ['--color-surface', surface],
    ['--color-surface-header', token(tokens, '--color-surface-header')],
    ['--color-selected', token(tokens, '--color-selected')],
    ['hover over --color-bg', hoverOver(bg)],
    ['hover over --color-surface', hoverOver(surface)],
    ['two hovers over --color-bg', hoverOver(hoverOver(bg))]
  ]
}

/** The APCA targets for text tokens on every text ground, as [foreground, minimum Lc]. */
const APCA_TEXT_TARGETS = [
  ['--color-text', LC_TEXT],
  ['--color-text-muted', LC_SECONDARY],
  ['--color-accent-strong', LC_SECONDARY]
] as const

/** Text that sits on a fill instead: the page ground on the accent, and diff lines on the surface. */
const APCA_FILL_PAIRS = [
  ['--color-bg', '--color-accent-strong'],
  ['--color-diff-add', '--color-surface'],
  ['--color-diff-remove', '--color-surface']
] as const

describe.each(Object.entries(schemes))('%s color scheme APCA', (_scheme, tokens) => {
  const cases = [
    ...APCA_TEXT_TARGETS.flatMap(([fg, minimum]) =>
      textGrounds(tokens).map(([label, hex]) => [fg, label, minimum, hex] as const)
    ),
    ...APCA_FILL_PAIRS.map(([fg, bg]) => [fg, bg, LC_SECONDARY, token(tokens, bg)] as const)
  ]

  it.each(cases)('%s on %s is at least Lc %s', (foreground, _label, minimum, ground) => {
    expect(Math.abs(apcaContrast(token(tokens, foreground), ground))).toBeGreaterThanOrEqual(
      minimum
    )
  })
})

/** The 4.5:1 text pairs, then the 3:1 pairs for a control's edge and the focus ring, as [foreground, background, minimum]. */
const PAIRS: readonly (readonly [string, string, number])[] = [
  ...TEXT_TOKENS.flatMap((fg) => WCAG_GROUNDS.map((bg) => [fg, bg, 4.5] as const)),
  ['--color-bg', '--color-accent-strong', 4.5],
  ...['--color-diff-add', '--color-diff-remove'].map((fg) => [fg, '--color-surface', 4.5] as const),
  ...CONTROL_GROUNDS.map((bg) => ['--color-border-strong', bg, 3] as const),
  ...[...CONTROL_GROUNDS, '--color-selected'].map((bg) => ['--focus-ring-color', bg, 3] as const)
]

describe.each(Object.entries(schemes))('%s color scheme', (_scheme, tokens) => {
  it.each(PAIRS)('%s on %s is at least %s:1', (foreground, background, minimum) => {
    expect(
      contrastRatio(token(tokens, foreground), token(tokens, background))
    ).toBeGreaterThanOrEqual(minimum)
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

describe.each(Object.entries(schemes))('%s color scheme hover tint', (_scheme, tokens) => {
  it('is text at --opacity-hover, the opacity the hover grounds are checked at', () => {
    expect(token(tokens, '--color-hover')).toMatch(
      /^color-mix\(\s*in srgb,\s*var\(--color-text\) calc\(var\(--opacity-hover\) \* 100%\),\s*transparent\s*\)$/
    )
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

describe('apcaContrast', () => {
  it.each([
    ['#888888', '#ffffff', 63.056],
    ['#ffffff', '#888888', -68.541],
    ['#000000', '#aaaaaa', 58.146],
    ['#aaaaaa', '#000000', -56.241]
  ] as const)('%s on %s is Lc %s (APCA-W3 0.0.98G reference)', (text, background, expected) => {
    expect(apcaContrast(text, background)).toBeCloseTo(expected, 3)
  })

  it('is 0 for identical colors', () => {
    expect(apcaContrast('#336699', '#336699')).toBe(0)
  })

  it('rejects a color that is not 6-digit hex', () => {
    expect(() => apcaContrast('red', '#ffffff')).toThrow('Not a 6-digit hex color')
  })
})
