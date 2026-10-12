import { describe, expect, it } from 'vitest'
import { platformOf } from '../platformOf'

describe('platformOf', () => {
  it.each([
    ['Darwin\n', 'darwin'],
    ['Linux\n', 'linux'],
    ['Darwin', 'darwin']
  ])('names %j as %s', (output, platform) => {
    expect(platformOf(output)).toBe(platform)
  })

  it.each(['', 'FreeBSD\n', 'MINGW64_NT\n'])('treats %j as darwin', (output) => {
    expect(platformOf(output)).toBe('darwin')
  })
})
