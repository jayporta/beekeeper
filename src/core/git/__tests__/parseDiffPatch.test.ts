import { describe, expect, it } from 'vitest'
import { parseDiffPatch } from '../parseDiffPatch'

interface RawEntry {
  /** The status field, such as `M`, `R100`, or `A`. */
  readonly status: string
  /** The path, or for a rename or copy the old path. */
  readonly path: string | Buffer
  /** The new path of a rename or copy. */
  readonly newPath?: string | Buffer
}

const nul = Buffer.from([0])

/** Builds `git diff --raw -z --patch` output: raw records, an empty record, then the patch. */
function output(entries: readonly RawEntry[], patch = ''): Buffer {
  const parts: Buffer[] = []
  for (const entry of entries) {
    parts.push(Buffer.from(`:100644 100644 aaaaaaa bbbbbbb ${entry.status}`), nul)
    parts.push(Buffer.from(entry.path), nul)
    if (entry.newPath !== undefined) parts.push(Buffer.from(entry.newPath), nul)
  }
  parts.push(nul, Buffer.from(patch))
  return Buffer.concat(parts)
}

const block = (header: string, body = '--- a/x\n+++ b/x\n@@ -1 +1 @@\n-old\n+new\n'): string =>
  `${header}\nindex aaaaaaa..bbbbbbb 100644\n${body}`

const modified = (path: string): string => block(`diff --git a/${path} b/${path}`)

describe('parseDiffPatch', () => {
  it('is empty when git printed nothing', () => {
    expect(parseDiffPatch(Buffer.alloc(0))).toEqual({ ok: true, value: [] })
  })

  it('gives one file its whole block as its patch', () => {
    const patch = modified('a.txt')

    const result = parseDiffPatch(output([{ status: 'M', path: 'a.txt' }], patch))

    expect(result).toEqual({
      ok: true,
      value: [{ path: 'a.txt', patch: Buffer.from(patch) }]
    })
  })

  it('splits several files at their headers, in order', () => {
    const [a, b, c] = [modified('a.txt'), modified('b.txt'), modified('c.txt')]
    const entries = ['a.txt', 'b.txt', 'c.txt'].map((path) => ({ status: 'M', path }))

    const result = parseDiffPatch(output(entries, a + b + c))

    expect(result.ok && result.value.map((file) => [file.path, file.patch.toString()])).toEqual([
      ['a.txt', a],
      ['b.txt', b],
      ['c.txt', c]
    ])
  })

  it('names a rename by its new path and keeps the old one', () => {
    const patch =
      'diff --git a/old.txt b/new.txt\nsimilarity index 100%\nrename from old.txt\nrename to new.txt\n'

    const result = parseDiffPatch(
      output([{ status: 'R100', path: 'old.txt', newPath: 'new.txt' }], patch)
    )

    expect(result.ok && result.value).toEqual([
      { path: 'new.txt', oldPath: 'old.txt', patch: Buffer.from(patch) }
    ])
  })

  it('names a copy by its new path and keeps the source', () => {
    const patch =
      'diff --git a/src.txt b/copy.txt\nsimilarity index 100%\ncopy from src.txt\ncopy to copy.txt\n'

    const result = parseDiffPatch(
      output([{ status: 'C100', path: 'src.txt', newPath: 'copy.txt' }], patch)
    )

    expect(result.ok && result.value[0]).toMatchObject({ path: 'copy.txt', oldPath: 'src.txt' })
  })

  it('keeps a binary file’s block', () => {
    const patch =
      'diff --git a/b.bin b/b.bin\nindex 6c612ad..1fd7071 100644\nBinary files a/b.bin and b/b.bin differ\n'

    const result = parseDiffPatch(output([{ status: 'M', path: 'b.bin' }], patch))

    expect(result.ok && result.value[0]?.patch.toString()).toBe(patch)
  })

  it('finds a file whose path has a space', () => {
    const result = parseDiffPatch(
      output([{ status: 'M', path: 'sp ace.txt' }], modified('sp ace.txt'))
    )

    expect(result.ok && result.value[0]?.path).toBe('sp ace.txt')
  })

  it.each([
    ['a non-ASCII path git quotes', 'é.txt', 'diff --git "a/\\303\\251.txt" "b/\\303\\251.txt"'],
    ['a non-ASCII path git leaves unquoted', 'é.txt', 'diff --git a/é.txt b/é.txt'],
    ['a path with a double quote', 'qu"ote.txt', 'diff --git "a/qu\\"ote.txt" "b/qu\\"ote.txt"'],
    [
      'a path with a backslash',
      'back\\slash.txt',
      'diff --git "a/back\\\\slash.txt" "b/back\\\\slash.txt"'
    ],
    ['a path with a tab', 'tab\there.txt', 'diff --git "a/tab\\there.txt" "b/tab\\there.txt"'],
    ['a path with a newline', 'new\nline.txt', 'diff --git "a/new\\nline.txt" "b/new\\nline.txt"'],
    [
      'a path with a control character',
      'bell\u0001.txt',
      'diff --git "a/bell\\001.txt" "b/bell\\001.txt"'
    ],
    [
      'a path with the delete character',
      'del\u007f.txt',
      'diff --git "a/del\\177.txt" "b/del\\177.txt"'
    ]
  ])('matches %s', (_label, path, header) => {
    const result = parseDiffPatch(output([{ status: 'M', path }], block(header)))

    expect(result.ok && result.value[0]?.path).toBe(path)
  })

  it('matches a path that is not valid UTF-8 by its bytes, and shows it with a replacement character', () => {
    const path = Buffer.concat([Buffer.from([0xff]), Buffer.from('bad.txt')])
    const header = 'diff --git "a/\\377bad.txt" "b/\\377bad.txt"'

    const result = parseDiffPatch(output([{ status: 'M', path }], block(header)))

    expect(result.ok && result.value[0]?.path).toBe('�bad.txt')
  })

  it('does not split at a line inside a patch that only looks like a header', () => {
    const body =
      '--- a/x\n+++ b/x\n@@ -1 +1 @@\n-diff --git a/fake b/fake\n+diff --git a/other b/other\n'
    const patch = block('diff --git a/a.txt b/a.txt', body)

    const result = parseDiffPatch(output([{ status: 'M', path: 'a.txt' }], patch))

    expect(result.ok && result.value).toHaveLength(1)
    expect(result.ok && result.value[0]?.patch.toString()).toBe(patch)
  })

  it('skips a changed file git printed no patch for', () => {
    const entries = ['a.txt', 'b.txt', 'c.txt'].map((path) => ({ status: 'M', path }))

    const result = parseDiffPatch(output(entries, modified('a.txt') + modified('c.txt')))

    expect(result.ok && result.value.map((file) => file.path)).toEqual(['a.txt', 'c.txt'])
  })

  it('ignores text before the first header, as git prints for an unmerged path', () => {
    const result = parseDiffPatch(
      output([{ status: 'M', path: 'a.txt' }], `* Unmerged path x\n${modified('a.txt')}`)
    )

    expect(result.ok && result.value.map((file) => file.path)).toEqual(['a.txt'])
  })

  it('keeps bytes that are not valid UTF-8 in a patch', () => {
    const patch = Buffer.concat([
      Buffer.from(`${modified('a.txt')}`),
      Buffer.from([0xff, 0xfe, 0x0a])
    ])
    const stdout = Buffer.concat([output([{ status: 'M', path: 'a.txt' }]), patch])

    const result = parseDiffPatch(stdout)

    expect(result.ok && result.value[0]?.patch.equals(patch)).toBe(true)
  })

  it('refuses a patch for a file git did not list', () => {
    const result = parseDiffPatch(output([{ status: 'M', path: 'a.txt' }], modified('other.txt')))

    expect(result).toEqual({ ok: false, error: 'malformed-numstat' })
  })

  it('refuses two patches for one listed file', () => {
    const entries = ['a.txt', 'b.txt'].map((path) => ({ status: 'M', path }))

    const result = parseDiffPatch(output(entries, modified('a.txt') + modified('a.txt')))

    expect(result).toEqual({ ok: false, error: 'malformed-numstat' })
  })

  describe('a type change between a file and a symlink', () => {
    // git prints a deletion and an addition under the same header.
    const removed =
      'diff --git a/x b/x\ndeleted file mode 100644\nindex ce01362..0000000\n--- a/x\n+++ /dev/null\n@@ -1 +0,0 @@\n-hello\n'
    const added =
      'diff --git a/x b/x\nnew file mode 120000\nindex 0000000..1de5659\n--- /dev/null\n+++ b/x\n@@ -0,0 +1 @@\n+target\n\\ No newline at end of file\n'

    it('joins both blocks into the one patch of that file', () => {
      const result = parseDiffPatch(output([{ status: 'T', path: 'x' }], removed + added))

      expect(result).toEqual({
        ok: true,
        value: [{ path: 'x', patch: Buffer.from(removed + added) }]
      })
    })

    it('keeps the files around it separate', () => {
      const entries = ['a.txt', 'x', 'b.txt'].map((path) => ({
        status: path === 'x' ? 'T' : 'M',
        path
      }))

      const result = parseDiffPatch(
        output(entries, modified('a.txt') + removed + added + modified('b.txt'))
      )

      expect(result.ok && result.value.map((file) => [file.path, file.patch.toString()])).toEqual([
        ['a.txt', modified('a.txt')],
        ['x', removed + added],
        ['b.txt', modified('b.txt')]
      ])
    })

    it('refuses a third block under the same header', () => {
      const result = parseDiffPatch(output([{ status: 'T', path: 'x' }], removed + added + added))

      expect(result).toEqual({ ok: false, error: 'malformed-numstat' })
    })
  })

  it('refuses patches in a different order than the file list', () => {
    const entries = ['a.txt', 'b.txt'].map((path) => ({ status: 'M', path }))

    const result = parseDiffPatch(output(entries, modified('b.txt') + modified('a.txt')))

    expect(result).toEqual({ ok: false, error: 'malformed-numstat' })
  })

  it.each([
    ['a record that does not start with a colon', Buffer.from('M\0a.txt\0\0')],
    ['a record with no terminator', Buffer.from(':100644 100644 a b M')],
    ['a path with no terminator', Buffer.from(':100644 100644 a b M\0a.txt')],
    ['a rename with one path', Buffer.from(':100644 100644 a b R100\0old.txt\0\0')],
    ['a record with no status', Buffer.from(':100644\0a.txt\0\0')],
    ['a record whose first byte is not a colon', Buffer.from('X100644 100644 a b M\0a.txt\0\0')],
    ['a changed file with no path', Buffer.from(':100644 100644 a b M\0\0\0')],
    ['a raw section with no end', Buffer.from(':100644 100644 a b M\0a.txt\0')]
  ])('refuses %s', (_label, stdout) => {
    expect(parseDiffPatch(stdout)).toEqual({ ok: false, error: 'malformed-numstat' })
  })
})
