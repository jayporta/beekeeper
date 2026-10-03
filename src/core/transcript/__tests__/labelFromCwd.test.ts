import { describe, expect, it } from 'vitest'
import { MAX_LABEL_CHARS, labelFromCwd } from '../labelFromCwd'

describe('labelFromCwd', () => {
  it.each([
    ['a POSIX path', '/Users/dev/acme-web', 'acme-web'],
    ['a Windows path', 'C:\\Users\\dev\\acme-web', 'acme-web'],
    ['a mixed-separator path', 'C:\\Users/dev\\acme-web', 'acme-web'],
    ['a trailing slash', '/Users/dev/acme-web/', 'acme-web'],
    ['repeated trailing separators', '/Users/dev/acme-web//\\', 'acme-web'],
    ['a name with spaces', '/Users/dev/My Project', 'My Project'],
    ['a non-ASCII name', '/Users/dev/café', 'café'],
    ['a single segment', 'acme-web', 'acme-web']
  ])('takes the last segment of %s', (_label, cwd, expected) => {
    expect(labelFromCwd(cwd)).toBe(expected)
  })

  it.each([
    ['an empty string', ''],
    ['the POSIX root', '/'],
    ['only separators', '//\\'],
    ['a bare Windows drive', 'C:\\']
  ])('returns null for %s', (_label, cwd) => {
    expect(labelFromCwd(cwd)).toBeNull()
  })

  it.each([
    ['a newline', '/Users/dev/a\nb'],
    ['a control character', '/Users/dev/a\u0007b'],
    ['a bidi override', '/Users/dev/a\u202Eb'],
    ['a non-breaking space', '/Users/dev/a\u00A0b']
  ])('returns null when the segment holds %s', (_label, cwd) => {
    expect(labelFromCwd(cwd)).toBeNull()
  })

  it('keeps a segment of exactly the maximum length', () => {
    const name = 'a'.repeat(MAX_LABEL_CHARS)

    expect(labelFromCwd(`/Users/dev/${name}`)).toBe(name)
  })

  it('returns null for a segment one past the maximum length', () => {
    expect(labelFromCwd(`/Users/dev/${'a'.repeat(MAX_LABEL_CHARS + 1)}`)).toBeNull()
  })

  it('ignores an unprintable character in an earlier segment', () => {
    expect(labelFromCwd('/Users/dev\n/acme-web')).toBe('acme-web')
  })

  it('returns null for a path longer than the path cap, without splitting it', () => {
    expect(labelFromCwd(`/${'a/'.repeat(3000)}acme-web`)).toBeNull()
  })
})
