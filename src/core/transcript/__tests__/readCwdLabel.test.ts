import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { MAX_HEAD_LINES, readCwdLabel } from '../readCwdLabel'
import { buildDiscoveryTree, type DiscoveryTree } from '../testDiscoveryTree'
import { buildCwdRecord, buildJsonlText } from '../testFixtures'

let tree: DiscoveryTree | undefined

afterEach(async () => {
  await tree?.cleanup()
  tree = undefined
})

/** Writes `text` as a transcript in a fresh tree and returns its path. */
async function transcriptWith(text: string): Promise<string> {
  tree = await buildDiscoveryTree({ files: { 't.jsonl': text } })
  return join(tree.root, 't.jsonl')
}

const noCwd = { type: 'summary', summary: 'no working directory here' }

describe('readCwdLabel', () => {
  it('labels the transcript with the last segment of its first cwd', async () => {
    const path = await transcriptWith(buildJsonlText([buildCwdRecord('/Users/dev/acme-web')]))

    expect(await readCwdLabel(path)).toBe('acme-web')
  })

  it('finds a cwd on a later line', async () => {
    const path = await transcriptWith(
      buildJsonlText([noCwd, noCwd, buildCwdRecord('/Users/dev/acme-web')])
    )

    expect(await readCwdLabel(path)).toBe('acme-web')
  })

  it('uses the first cwd when later records name another directory', async () => {
    const path = await transcriptWith(
      buildJsonlText([buildCwdRecord('/Users/dev/first'), buildCwdRecord('/Users/dev/second')])
    )

    expect(await readCwdLabel(path)).toBe('first')
  })

  it('reads a Windows-style cwd', async () => {
    const path = await transcriptWith(
      buildJsonlText([buildCwdRecord('C:\\Users\\dev\\acme-web\\')])
    )

    expect(await readCwdLabel(path)).toBe('acme-web')
  })

  it('skips records whose cwd is not a string', async () => {
    const path = await transcriptWith(
      buildJsonlText([
        { cwd: 42 },
        { cwd: null },
        { cwd: ['/a/b'] },
        buildCwdRecord('/Users/dev/acme-web')
      ])
    )

    expect(await readCwdLabel(path)).toBe('acme-web')
  })

  it('skips malformed lines and non-object lines', async () => {
    const path = await transcriptWith(
      `not json\n[1,2]\n"text"\n${JSON.stringify(buildCwdRecord('/Users/dev/acme-web'))}\n`
    )

    expect(await readCwdLabel(path)).toBe('acme-web')
  })

  it('tolerates unknown extra fields on the record', async () => {
    const path = await transcriptWith(
      buildJsonlText([{ ...buildCwdRecord('/Users/dev/acme-web'), futureField: { nested: true } }])
    )

    expect(await readCwdLabel(path)).toBe('acme-web')
  })

  it('returns null when no record has a cwd', async () => {
    const path = await transcriptWith(buildJsonlText([noCwd, noCwd]))

    expect(await readCwdLabel(path)).toBeNull()
  })

  it('returns null for an empty transcript', async () => {
    expect(await readCwdLabel(await transcriptWith(''))).toBeNull()
  })

  it('finds a cwd on the last line it reads', async () => {
    const records = [
      ...Array(MAX_HEAD_LINES - 1).fill(noCwd),
      buildCwdRecord('/Users/dev/acme-web')
    ]

    expect(await readCwdLabel(await transcriptWith(buildJsonlText(records)))).toBe('acme-web')
  })

  it('stops after the head lines, so a later cwd is not found', async () => {
    const records = [...Array(MAX_HEAD_LINES).fill(noCwd), buildCwdRecord('/Users/dev/acme-web')]

    expect(await readCwdLabel(await transcriptWith(buildJsonlText(records)))).toBeNull()
  })

  it('skips an oversized line and keeps reading', async () => {
    const oversized = JSON.stringify({
      ...buildCwdRecord('/Users/dev/big'),
      pad: 'x'.repeat(1_100_000)
    })
    const path = await transcriptWith(
      `${oversized}\n${JSON.stringify(buildCwdRecord('/Users/dev/acme-web'))}\n`
    )

    expect(await readCwdLabel(path)).toBe('acme-web')
  })

  it('counts an oversized line toward the head lines', async () => {
    const oversized = JSON.stringify({ pad: 'x'.repeat(1_100_000) })
    const head = [oversized, ...Array<string>(MAX_HEAD_LINES - 1).fill(JSON.stringify(noCwd))]
    const path = await transcriptWith(
      `${head.join('\n')}\n${JSON.stringify(buildCwdRecord('/Users/dev/acme-web'))}\n`
    )

    expect(await readCwdLabel(path)).toBeNull()
  })

  it('returns null when the first cwd has an unprintable segment', async () => {
    const path = await transcriptWith(
      buildJsonlText([
        buildCwdRecord('/Users/dev/bad\nname'),
        buildCwdRecord('/Users/dev/acme-web')
      ])
    )

    expect(await readCwdLabel(path)).toBeNull()
  })

  it('rejects with the system error when the transcript does not exist', async () => {
    tree = await buildDiscoveryTree({})

    await expect(readCwdLabel(join(tree.root, 'missing.jsonl'))).rejects.toMatchObject({
      code: 'ENOENT'
    })
  })
})
