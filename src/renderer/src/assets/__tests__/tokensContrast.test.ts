import { describe, expect, it } from 'vitest'
import { apcaContrast, blendOver, contrastRatio } from '../testContrast'
import { readTokenSchemes, type TokenValues } from '../testTokens'

const schemes = readTokenSchemes(new URL('../tokens.css', import.meta.url))

/** The minimum absolute APCA Lc for body text, and for secondary text, accent text and diff lines. */
const LC_TEXT = 90
const LC_SECONDARY = 75

const TEXT_TOKENS = [
  '--color-text',
  '--color-text-muted',
  '--color-accent-strong',
  '--color-selected-text'
]
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
  const accent = token(tokens, '--color-accent')
  const opacity = Number(token(tokens, '--opacity-hover'))
  if (Number.isNaN(opacity)) throw new Error('--opacity-hover is not a number')
  const bg = token(tokens, '--color-bg')
  const surface = token(tokens, '--color-surface')
  const hoverOver = (ground: string): string => blendOver(accent, ground, opacity)
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
  ['--color-accent-strong', LC_SECONDARY],
  ['--color-selected-text', LC_SECONDARY]
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

const PROJECT_SLOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const

/** Text on its own fill at 4.5:1, as [foreground, background]: pills, file ops, project buttons, the lead mark, and KPI tiles. */
const PILL_PAIRS: readonly (readonly [string, string])[] = [
  ...['error', 'warning', 'neutral', 'info'].map(
    (kind) => [`--color-pill-${kind}-text`, `--color-pill-${kind}-bg`] as const
  ),
  ...['create', 'update'].map((op) => [`--color-op-${op}-text`, `--color-op-${op}-bg`] as const),
  ...PROJECT_SLOTS.map(
    (slot) => [`--color-project-ink-${slot}`, `--color-project-button-${slot}`] as const
  ),
  ['--color-kind-lead-text', '--color-kind-lead'],
  ['--color-segment-selected-text', '--color-bg'],
  ['--color-text-muted', '--color-segment-track'],
  ...['tokens', 'api', 'sessions', 'agents'].flatMap((kpi) =>
    ['--color-kpi-label', '--color-kpi-sub'].map((text) => [text, `--color-kpi-${kpi}-bg`] as const)
  )
]

/** Marks that carry meaning in a chart, a bar, or a graph: 3:1 against the card ground they sit on (WCAG 1.4.11). */
const MARK_TOKENS = [
  '--color-token-input',
  '--color-token-output',
  '--color-token-cache-write',
  '--color-token-cache-read',
  '--color-model-fable',
  '--color-model-opus',
  '--color-model-sonnet',
  '--color-model-haiku',
  '--color-model-other',
  '--color-kind-lead',
  '--color-kind-teammate',
  '--color-kind-workflow',
  '--color-kind-subagent'
]

describe.each(Object.entries(schemes))('%s color scheme pills and fills', (_scheme, tokens) => {
  it.each(PILL_PAIRS)('%s on %s is at least 4.5:1', (foreground, background) => {
    expect(
      contrastRatio(token(tokens, foreground), token(tokens, background))
    ).toBeGreaterThanOrEqual(4.5)
  })
})

describe.each(Object.entries(schemes))('%s color scheme marks', (_scheme, tokens) => {
  it.each(MARK_TOKENS)('%s is at least 3:1 against the ground', (mark) => {
    expect(contrastRatio(token(tokens, mark), token(tokens, '--color-bg'))).toBeGreaterThanOrEqual(
      3
    )
  })
})

/** The agent kinds' marks also sit in the teammate sub-table and on a hovered or matched row. */
const KIND_MARK_TOKENS = MARK_TOKENS.filter((mark) => mark.startsWith('--color-kind-'))

describe.each(Object.entries(schemes))('%s color scheme agent kind marks', (_scheme, tokens) => {
  it.each(
    KIND_MARK_TOKENS.flatMap((mark) =>
      ['--color-surface', '--color-selected'].map((ground) => [mark, ground] as const)
    )
  )('%s is at least 3:1 against %s', (mark, ground) => {
    expect(contrastRatio(token(tokens, mark), token(tokens, ground))).toBeGreaterThanOrEqual(3)
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

/** The model colors, in the order the chart stacks them. */
const MODEL_TOKENS = [
  '--color-model-fable',
  '--color-model-opus',
  '--color-model-sonnet',
  '--color-model-haiku',
  '--color-model-other'
]

describe.each(Object.entries(schemes))('%s color scheme model colors', (_scheme, tokens) => {
  // The card is on the page ground (--color-bg); the surface is the other ground a chart can sit on.
  it.each(
    MODEL_TOKENS.flatMap((model) =>
      ['--color-bg', '--color-surface'].map((ground) => [model, ground] as const)
    )
  )('%s is at least 3:1 against %s (WCAG 1.4.11)', (model, ground) => {
    expect(contrastRatio(token(tokens, model), token(tokens, ground))).toBeGreaterThanOrEqual(3)
  })

  it('gives every model its own color', () => {
    const colors = MODEL_TOKENS.map((model) => token(tokens, model).toLowerCase())

    expect(new Set(colors).size).toBe(MODEL_TOKENS.length)
  })
})

describe.each(Object.entries(schemes))('%s color scheme segmented control', (_scheme, tokens) => {
  // The selected segment is the page ground on the track, so the track has to differ from the card ground.
  it('has a track that differs from the card ground', () => {
    expect(token(tokens, '--color-segment-track').toLowerCase()).not.toBe(
      token(tokens, '--color-bg').toLowerCase()
    )
  })
})

describe.each(Object.entries(schemes))('%s color scheme hover tint', (_scheme, tokens) => {
  it('is the accent at --opacity-hover, the opacity the hover grounds are checked at', () => {
    expect(token(tokens, '--color-hover')).toMatch(
      /^color-mix\(\s*in srgb,\s*var\(--color-accent\) calc\(var\(--opacity-hover\) \* 100%\),\s*transparent\s*\)$/
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
