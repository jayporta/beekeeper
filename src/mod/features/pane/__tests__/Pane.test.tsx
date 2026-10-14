import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { Pane, type PaneElements } from '../Pane'
import {
  installTestH,
  findAll,
  removeTestH,
  textOf,
  type TestNode
} from '../../shared/testElements'
import { testPaneNode, testPaneView } from '../testPaneView'
import type { PaneView } from '../paneView'

const Box = (): object => ({})
const Text = (): object => ({})
const Button = (): object => ({})
const elements = { Box, Text, Button } as unknown as PaneElements

function draw(
  view: PaneView | undefined,
  options: {
    selected?: { sessionId: string; key: string } | null
    onSelect?: (key: string) => void
    columns?: number
  } = {}
): TestNode {
  return Pane({
    elements,
    view,
    selected: options.selected ?? null,
    onSelect: options.onSelect ?? (() => {}),
    nav: undefined,
    browse: undefined,
    onNav: () => {},
    onPickProject: () => {},
    columns: options.columns
  }) as TestNode
}

const rows = (tree: TestNode): TestNode[] =>
  findAll(tree, Button).filter((node) => !String(node.props['key']).startsWith('nav-'))
const rowText = (tree: TestNode): string[] => rows(tree).map((row) => textOf(row))

const team = testPaneNode('lead', {
  kind: 'lead',
  name: 'Lead',
  tokens: 12_345,
  children: [
    testPaneNode('sub:a', {
      name: 'finder',
      agentType: 'Explore',
      tokens: 1,
      toolErrors: 3,
      compactions: 1,
      stopped: true,
      partial: true,
      children: [testPaneNode('sub:b', { name: 'deep' })]
    }),
    testPaneNode('mate:x', { kind: 'teammate', name: 'writer', files: null })
  ]
})

describe('Pane', () => {
  beforeAll(installTestH)
  afterAll(removeTestH)

  it('draws the title and the session label', () => {
    const text = textOf(draw(testPaneView(team)))

    expect(text).toContain('beekeeper')
    expect(text).toContain('Fix the bug')
  })

  it.each([
    ['one token', 1, 'tokens', '1 token in this session'],
    ['a compact count', 12_345, 'tokens', '12.3K tokens in this session']
  ])('shows %s on the totals line', (_name, total, _unit, expected) => {
    expect(textOf(draw(testPaneView(team, { totalTokens: total })))).toContain(expected)
  })

  it('says there is no usage when there are no tokens', () => {
    expect(textOf(draw(testPaneView(team)))).toContain('No token usage yet.')
  })

  it('says the total may be incomplete when it is partial', () => {
    const text = textOf(draw(testPaneView(team, { totalTokens: 5, totalTokensPartial: true })))

    expect(text).toContain('5 tokens in this session. May be incomplete.')
  })

  it('draws one button per node, keyed by node key, in tree order', () => {
    const tree = draw(testPaneView(team))

    expect(rows(tree).map((row) => row.props['key'])).toEqual(['lead', 'sub:a', 'sub:b', 'mate:x'])
  })

  it('indents two spaces per depth', () => {
    const lines = rowText(draw(testPaneView(team)))

    expect(lines.map((line) => line.length - line.trimStart().length)).toEqual([0, 2, 4, 2])
  })

  it('caps the indent so names keep their room', () => {
    let chain = testPaneNode('n9')
    for (let depth = 8; depth >= 0; depth -= 1) {
      chain = testPaneNode(`n${depth}`, { children: [chain] })
    }
    const lines = rowText(draw(testPaneView(chain)))

    expect(lines.at(-1)).toBe(`${' '.repeat(12)}n9`)
  })

  it('puts the important facts before the tokens and the type, which are cut first', () => {
    const line = rowText(draw(testPaneView(team)))[1]

    expect(line).toBe(
      '  finder  stopped, may be incomplete, 3 tool errors, 1 compaction, 1 token, Explore'
    )
  })

  it('puts two spaces before a type that has no facts to follow', () => {
    const root = testPaneNode('lead', { name: 'Lead', agentType: 'general-purpose' })

    expect(rowText(draw(testPaneView(root)))[0]?.trim()).toBe('Selected: Lead  general-purpose')
  })

  it('cuts a long agent name so the facts stay in view', () => {
    const long = testPaneNode('lead', { kind: 'lead', name: 'n'.repeat(500), tokens: 12_345 })

    const text = rowText(draw(testPaneView(long)))[0] ?? ''

    expect(text.length).toBeLessThan(150)
    expect(text).toContain('12.3K tokens')
    expect(text).toContain('…')
  })

  it("cuts a long agent name to the pane's width so the facts stay in view", () => {
    const long = testPaneNode('lead', { kind: 'lead', name: 'n'.repeat(500), tokens: 12_345 })

    const text = rowText(draw(testPaneView(long), { columns: 60 }))[0] ?? ''

    expect(text.length).toBeLessThanOrEqual(60)
    expect(text).toContain('12.3K tokens')
  })

  it('leaves out marks the agent does not have', () => {
    const line = rowText(draw(testPaneView(team)))[2]

    expect(line?.trim()).toBe('deep')
  })

  it('says a teammate row is a teammate and a workflow row is a workflow', () => {
    const root = testPaneNode('lead', {
      kind: 'lead',
      name: 'Lead',
      children: [
        testPaneNode('mate:x', { kind: 'teammate', name: 'writer', files: null }),
        testPaneNode('run:1', { kind: 'workflow', name: 'flow', files: null }),
        testPaneNode('sub:a', { name: 'finder' })
      ]
    })
    const lines = rowText(draw(testPaneView(root))).map((line) => line.trim())

    expect(lines).toEqual(['Selected: Lead', 'Teammate: writer', 'Workflow: flow', 'finder'])
  })

  it('cuts each row at the edge with an ellipsis', () => {
    const texts = rows(draw(testPaneView(team))).flatMap((row) => findAll(row, Text))

    expect(texts.length).toBeGreaterThan(0)
    expect(texts[0]?.props['wrap']).toBe('truncate-end')
  })

  it('marks the lead as selected when nothing is', () => {
    const lines = rowText(draw(testPaneView(team)))

    expect(lines.map((line) => line.trimStart().startsWith('Selected: '))).toEqual([
      true,
      false,
      false,
      false
    ])
  })

  it('marks the node the person selected', () => {
    const lines = rowText(draw(testPaneView(team), { selected: { sessionId: 's1', key: 'sub:b' } }))

    expect(lines.map((line) => line.trimStart().startsWith('Selected: '))).toEqual([
      false,
      false,
      true,
      false
    ])
  })

  it('falls back to the lead when the selected node is gone', () => {
    const lines = rowText(
      draw(testPaneView(team), { selected: { sessionId: 's1', key: 'sub:zzz' } })
    )

    expect(lines[0]?.trimStart().startsWith('Selected: ')).toBe(true)
  })

  it('ignores a selection made in another session', () => {
    const lines = rowText(
      draw(testPaneView(team), { selected: { sessionId: 'old', key: 'sub:b' } })
    )

    expect(lines[0]?.trimStart().startsWith('Selected: ')).toBe(true)
  })

  it('selects a node when its row is pressed', () => {
    const onSelect = vi.fn()
    const tree = draw(testPaneView(team), { onSelect })

    ;(rows(tree)[1]?.props['onPress'] as () => void)()

    expect(onSelect).toHaveBeenCalledWith('sub:a')
  })

  describe('the selected agent’s files', () => {
    const withFiles = testPaneNode('lead', {
      kind: 'lead',
      name: 'Lead',
      files: [
        { path: '/a.ts', operation: 'edit' },
        { path: '/b.ts', operation: 'create' }
      ]
    })

    it('lists each file with what was done to it', () => {
      const text = textOf(draw(testPaneView(withFiles)))

      expect(text).toContain('Files changed by Lead')
      expect(text).toContain('edited /a.ts')
      expect(text).toContain('created /b.ts')
    })

    it('shows the files of the selected node, not the lead', () => {
      const root = testPaneNode('lead', {
        kind: 'lead',
        files: [{ path: '/lead.ts', operation: 'edit' }],
        children: [testPaneNode('sub:a', { files: [{ path: '/sub.ts', operation: 'delete' }] })]
      })
      const text = textOf(draw(testPaneView(root), { selected: { sessionId: 's1', key: 'sub:a' } }))

      expect(text).toContain('deleted /sub.ts')
      expect(text).not.toContain('/lead.ts')
    })

    it('shows at most 200 files and says how many more there are', () => {
      const many = testPaneNode('lead', {
        kind: 'lead',
        files: Array.from({ length: 200 }, (_, i) => ({ path: `/f${i}.ts`, operation: 'edit' })),
        fileCount: 205
      })
      const text = textOf(draw(testPaneView(many)))

      expect(text).toContain('/f199.ts')
      expect(text).toContain('and 5 more')
    })

    it('cuts a long path from its start so the file name survives', () => {
      const tree = draw(testPaneView(withFiles))
      const paths = findAll(tree, Text).filter((node) => textOf(node) === '/a.ts')

      expect(paths[0]?.props['wrap']).toBe('truncate-start')
    })

    it('says so when no files changed', () => {
      expect(textOf(draw(testPaneView(testPaneNode('lead', { kind: 'lead' }))))).toContain(
        'No files changed.'
      )
    })

    it('warns when the list may be missing files', () => {
      const root = testPaneNode('lead', { kind: 'lead', filesIncomplete: true })

      expect(textOf(draw(testPaneView(root)))).toContain('This list may be missing files.')
    })

    it('points a teammate to its own session', () => {
      const text = textOf(
        draw(testPaneView(team), { selected: { sessionId: 's1', key: 'mate:x' } })
      )

      expect(text).toContain("This teammate's files show in its own session.")
    })

    it('tells a workflow run to select one of its agents', () => {
      const root = testPaneNode('lead', {
        kind: 'lead',
        children: [testPaneNode('run:1', { kind: 'workflow', files: null })]
      })
      const text = textOf(draw(testPaneView(root), { selected: { sessionId: 's1', key: 'run:1' } }))

      expect(text).toContain('A workflow run lists no files.')
    })
  })

  describe('without a tree', () => {
    it('says it is loading when there is no view yet', () => {
      const tree = draw(undefined)

      expect(textOf(tree)).toContain('Loading the session.')
      expect(rows(tree)).toEqual([])
    })

    it('says it is loading while a view is loading', () => {
      const view = testPaneView(team, { status: 'loading', root: null })

      expect(textOf(draw(view))).toContain('Loading the session.')
    })

    it("says it is waiting for the session's first turn", () => {
      const view = testPaneView(team, { status: 'waiting', root: null })

      expect(textOf(draw(view))).toContain("Waiting for the session's first turn.")
    })

    it.each([
      ['invalid-request', "beekeeper couldn't tell which session this is."],
      ['untrusted-sender', 'beekeeper refused the request.'],
      ['not-found', "beekeeper can't find this session's transcript."],
      ['unreadable', "beekeeper couldn't read this session's transcript."],
      ['internal', 'Something went wrong while reading the session.']
    ] as const)('says a fixed line for the %s error', (code, line) => {
      const view = testPaneView(team, { status: 'error', errorCode: code, root: null })

      expect(textOf(draw(view))).toContain(line)
    })
  })
})
