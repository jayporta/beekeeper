import { describe, expect, it } from 'vitest'
import { patchRuns } from '../patchRuns'

describe('patchRuns', () => {
  it('is nothing for an empty patch', () => {
    expect(patchRuns('')).toEqual([])
  })

  it('marks lines that start with a plus as added and with a minus as removed', () => {
    expect(patchRuns('+new\n-old\n')).toEqual([
      { kind: 'add', text: '+new\n' },
      { kind: 'remove', text: '-old\n' }
    ])
  })

  it('groups consecutive lines of one kind into a single run', () => {
    expect(patchRuns('+a\n+b\n+c\n')).toEqual([{ kind: 'add', text: '+a\n+b\n+c\n' }])
  })

  it('leaves context lines and hunk headers unmarked', () => {
    expect(patchRuns(' context\n@@ -1 +1 @@\n+x\n')).toEqual([
      { kind: 'other', text: ' context\n@@ -1 +1 @@\n' },
      { kind: 'add', text: '+x\n' }
    ])
  })

  it('looks only at the first character of a line, so no other parsing happens', () => {
    const runs = patchRuns('diff --git a/x b/x\n--- a/x\n+++ b/x\n index\n+ +plus\n- -minus\n')

    expect(runs.map((run) => run.kind)).toEqual([
      'other',
      'remove',
      'add',
      'other',
      'add',
      'remove'
    ])
  })

  it('keeps every character, so the runs together are the patch', () => {
    const patch =
      'diff --git a/x b/x\n@@ -1,2 +1,2 @@\n-a\n+b\n tail\n\\ No newline at end of file\n'

    expect(
      patchRuns(patch)
        .map((run) => run.text)
        .join('')
    ).toBe(patch)
  })

  it('keeps a last line that has no newline', () => {
    expect(patchRuns('+a\n+b')).toEqual([{ kind: 'add', text: '+a\n+b' }])
  })

  it('treats an empty line as an unmarked line', () => {
    expect(patchRuns('+a\n\n+b\n').map((run) => run.kind)).toEqual(['add', 'other', 'add'])
  })

  it('does not interpret markup, only splits text', () => {
    expect(patchRuns('+<script>alert(1)</script>\n')).toEqual([
      { kind: 'add', text: '+<script>alert(1)</script>\n' }
    ])
  })

  it('splits a patch of tens of thousands of lines without recursing', () => {
    const patch = Array.from({ length: 60_000 }, (_, i) => (i % 2 === 0 ? '+a\n' : '-b\n')).join('')

    expect(patchRuns(patch)).toHaveLength(60_000)
  })
})
