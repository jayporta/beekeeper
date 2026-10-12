import { describe, expect, it } from 'vitest'
import { isAllowedArgv } from '../isAllowedArgv'

describe('isAllowedArgv', () => {
  it.each([
    ['git by absolute path', '/opt/homebrew/bin/git', ['status']],
    ['git with no arguments', '/usr/bin/git', []],
    ['the xcode-select probe', '/usr/bin/xcode-select', ['-p']],
    ['the xcrun probe', '/usr/bin/xcrun', ['--find', 'git']]
  ])('allows %s', (_name, file, args) => {
    expect(isAllowedArgv(file, args)).toBe(true)
  })

  it.each([
    ['another program', '/usr/bin/curl', ['https://example.com']],
    ['git by relative path', 'git', ['status']],
    ['a program that only ends in git', '/usr/bin/digit', []],
    ['a program in a folder named git', '/opt/git/bin/curl', []],
    ['xcode-select with other arguments', '/usr/bin/xcode-select', ['--install']],
    ['xcrun with other arguments', '/usr/bin/xcrun', ['--find', 'curl']],
    ['xcrun with extra arguments', '/usr/bin/xcrun', ['--find', 'git', '--sdk', 'x']],
    ['an empty path', '', []]
  ])('refuses %s', (_name, file, args) => {
    expect(isAllowedArgv(file, args)).toBe(false)
  })
})
