import { describe, expect, it } from 'vitest'
import { cleanPatchText } from '../cleanPatchText'

describe('cleanPatchText', () => {
  it('keeps newlines and removes ESC, CR, tabs and a lone surrogate', () => {
    const cleaned = cleanPatchText('+a\u001b[31mb\r\n+c\td\n+\ud800e\n')

    for (const char of ['\u001b', '\r', '\t', '\ud800']) expect(cleaned).not.toContain(char)
    expect(cleaned.split('\n')).toHaveLength(4)
  })

  it('leaves printable text as it is', () => {
    expect(cleanPatchText('@@ -1 +1 @@\n-old\n+new é\n')).toBe('@@ -1 +1 @@\n-old\n+new é\n')
  })
})
