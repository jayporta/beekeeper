import { describe, expect, it } from 'vitest'
import { MAX_FILE_DIFF_CHARS } from '../fileChange'
import { readFileChanges } from '../readFileChanges'
import {
  TEST_DIFF_FILE,
  buildBashResultRecord,
  buildEditResultRecord,
  buildHunk,
  buildWriteResultRecord,
  registerTranscriptWriter
} from '../testFileDiffFixtures'

const transcripts = registerTranscriptWriter()

async function read(
  lines: readonly unknown[],
  ids: readonly string[],
  filePath = TEST_DIFF_FILE
): ReturnType<typeof readFileChanges> {
  return readFileChanges({
    transcriptPath: await transcripts.write(lines),
    toolUseIds: new Set(ids),
    filePath
  })
}

describe('readFileChanges edit and write results', () => {
  it('returns an Edit result hunks as a patch', async () => {
    const hunk = buildHunk({ oldStart: 4, newStart: 5, lines: ['-old', '+new'] })
    const result = await read(
      [buildEditResultRecord({ toolUseId: 'e1', structuredPatch: [hunk] })],
      ['e1']
    )

    expect(result.byToolUseId.get('e1')).toEqual({
      kind: 'patch',
      hunks: [{ oldStart: 4, oldLines: 1, newStart: 5, newLines: 2, lines: ['-old', '+new'] }],
      userModified: false,
      shared: false,
      cut: false
    })
    expect(result.truncated).toBe(false)
  })

  it('turns a Write create into one hunk of added lines', async () => {
    const result = await read(
      [
        buildWriteResultRecord({
          toolUseId: 'w1',
          type: 'create',
          content: 'a\nb\n',
          structuredPatch: []
        })
      ],
      ['w1']
    )

    expect(result.byToolUseId.get('w1')).toEqual({
      kind: 'patch',
      hunks: [{ oldStart: 0, oldLines: 0, newStart: 1, newLines: 2, lines: ['+a', '+b'] }],
      userModified: false,
      shared: false,
      cut: false
    })
  })

  it('gives an empty created file no hunks', async () => {
    const result = await read(
      [buildWriteResultRecord({ toolUseId: 'w1', type: 'create', content: '' })],
      ['w1']
    )

    expect(result.byToolUseId.get('w1')).toMatchObject({ kind: 'patch', hunks: [] })
  })

  it('uses the structuredPatch of a Write update', async () => {
    const result = await read(
      [
        buildWriteResultRecord({
          toolUseId: 'w1',
          type: 'update',
          content: 'whole file',
          structuredPatch: [buildHunk()]
        })
      ],
      ['w1']
    )

    expect(result.byToolUseId.get('w1')).toMatchObject({
      kind: 'patch',
      hunks: [{ lines: [' keep', '+added'] }]
    })
  })

  it('keeps userModified when the person edited the change', async () => {
    const result = await read(
      [buildEditResultRecord({ toolUseId: 'e1', structuredPatch: [], userModified: true })],
      ['e1']
    )

    expect(result.byToolUseId.get('e1')).toMatchObject({ userModified: true })
  })

  it.each([
    ['no structuredPatch', buildEditResultRecord({ toolUseId: 'e1' })],
    [
      'a malformed structuredPatch',
      buildEditResultRecord({ toolUseId: 'e1', structuredPatch: [{ lines: 'x' }] })
    ],
    [
      'a string result',
      {
        type: 'user',
        message: { content: [{ type: 'tool_result', tool_use_id: 'e1' }] },
        toolUseResult: 'Error: nope'
      }
    ],
    [
      'a different file',
      buildEditResultRecord({
        toolUseId: 'e1',
        filePath: '/other.ts',
        structuredPatch: [buildHunk()]
      })
    ]
  ])('reads %s as unrecorded', async (_label, record) => {
    const result = await read([record], ['e1'])

    expect(result.byToolUseId.get('e1')).toEqual({ kind: 'unrecorded' })
  })

  it('ignores a result whose id was not requested', async () => {
    const result = await read(
      [buildEditResultRecord({ toolUseId: 'other', structuredPatch: [buildHunk()] })],
      ['e1']
    )

    expect(result.byToolUseId.size).toBe(0)
  })

  it('keeps the first result for an id', async () => {
    const result = await read(
      [
        buildEditResultRecord({
          toolUseId: 'e1',
          structuredPatch: [buildHunk({ lines: ['+first'] })]
        }),
        buildEditResultRecord({
          toolUseId: 'e1',
          structuredPatch: [buildHunk({ lines: ['+second'] })]
        })
      ],
      ['e1']
    )

    expect(result.byToolUseId.get('e1')).toMatchObject({ hunks: [{ lines: ['+first'] }] })
  })

  it('skips malformed and non-object lines', async () => {
    const result = await read(
      [
        '{not json',
        '42',
        buildEditResultRecord({ toolUseId: 'e1', structuredPatch: [buildHunk()] })
      ],
      ['e1']
    )

    expect(result.byToolUseId.get('e1')).toMatchObject({ kind: 'patch' })
  })
})

describe('readFileChanges bash results', () => {
  const entry = { filePath: TEST_DIFF_FILE, hunks: [buildHunk()] }

  it('reads the hunks of the entry for the file', async () => {
    const result = await read(
      [buildBashResultRecord({ toolUseId: 'b1', bashEditDiff: { files: [entry] } })],
      ['b1']
    )

    expect(result.byToolUseId.get('b1')).toMatchObject({
      kind: 'patch',
      hunks: [{ lines: [' keep', '+added'] }],
      shared: false
    })
  })

  it('flags a shared diff', async () => {
    const result = await read(
      [buildBashResultRecord({ toolUseId: 'b1', bashEditDiff: { files: [entry], shared: true } })],
      ['b1']
    )

    expect(result.byToolUseId.get('b1')).toMatchObject({ shared: true })
  })

  it.each([
    ['an entry for another file only', { files: [{ ...entry, filePath: '/other.ts' }] }],
    ['an entry with no hunks', { files: [{ filePath: TEST_DIFF_FILE, hunks: [] }] }],
    ['only a changedFiles list', { changedFiles: [TEST_DIFF_FILE] }]
  ])('reads %s as unrecorded', async (_label, bashEditDiff) => {
    const result = await read([buildBashResultRecord({ toolUseId: 'b1', bashEditDiff })], ['b1'])

    expect(result.byToolUseId.get('b1')).toEqual({ kind: 'unrecorded' })
  })
})

describe('readFileChanges size cap', () => {
  it('cuts a huge Write at the cap and says so', async () => {
    const line = 'x'.repeat(999)
    const content = `${line}\n`.repeat(700)
    const result = await read(
      [buildWriteResultRecord({ toolUseId: 'w1', type: 'create', content })],
      ['w1']
    )

    const change = result.byToolUseId.get('w1')
    const kept = change?.kind === 'patch' ? change.hunks.flatMap((hunk) => hunk.lines) : []
    expect(result.truncated).toBe(true)
    expect(kept.length).toBeGreaterThan(0)
    expect(kept.reduce((total, text) => total + text.length, 0)).toBeLessThanOrEqual(
      MAX_FILE_DIFF_CHARS
    )
  })

  it('stops reading once the cap cuts a change, leaving later ids without an entry', async () => {
    const big = `${'y'.repeat(999)}\n`.repeat(700)
    const result = await read(
      [
        buildWriteResultRecord({ toolUseId: 'w1', type: 'create', content: big }),
        buildEditResultRecord({ toolUseId: 'e1', structuredPatch: [buildHunk()] })
      ],
      ['w1', 'e1']
    )

    expect(result.byToolUseId.get('w1')).toMatchObject({ cut: true })
    expect(result.byToolUseId.has('e1')).toBe(false)
  })

  it('marks a change the cap did not touch as not cut', async () => {
    const result = await read(
      [buildEditResultRecord({ toolUseId: 'e1', structuredPatch: [buildHunk()] })],
      ['e1']
    )

    expect(result.byToolUseId.get('e1')).toMatchObject({ cut: false })
  })

  it('charges for hunks with no lines, so many empty hunks reach the cap', async () => {
    const empty = buildHunk({ lines: [] })
    const result = await read(
      [buildEditResultRecord({ toolUseId: 'e1', structuredPatch: Array(10_000).fill(empty) })],
      ['e1']
    )

    const change = result.byToolUseId.get('e1')
    expect(result.truncated).toBe(true)
    expect(change).toMatchObject({ kind: 'patch', cut: true })
    expect(change?.kind === 'patch' && change.hunks.length).toBeLessThan(10_000)
  })

  it('charges for empty lines, so many of them reach the cap', async () => {
    const result = await read(
      [
        buildEditResultRecord({
          toolUseId: 'e1',
          structuredPatch: [buildHunk({ lines: Array(20_000).fill('') })]
        })
      ],
      ['e1']
    )

    expect(result.truncated).toBe(true)
  })

  it('recomputes the line counts of a hunk cut partway from the lines it kept', async () => {
    const lines = ['x'.repeat(999), ...Array(1000).fill('+' + 'z'.repeat(998))].map(
      (text, index) => (index === 0 ? ` ${text}` : text)
    )
    const result = await read(
      [
        buildEditResultRecord({
          toolUseId: 'e1',
          structuredPatch: [buildHunk({ oldLines: 1, newLines: 1001, lines })]
        })
      ],
      ['e1']
    )

    const change = result.byToolUseId.get('e1')
    const [hunk] = change?.kind === 'patch' ? change.hunks : []
    expect(hunk?.lines.length).toBeLessThan(lines.length)
    expect(hunk?.oldLines).toBe(1)
    expect(hunk?.newLines).toBe(hunk?.lines.length)
  })
})
