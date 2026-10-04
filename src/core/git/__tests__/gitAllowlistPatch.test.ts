import { describe, expect, it } from 'vitest'
import { assertAllowedGitArgs, PATCH_ARGS } from '../gitAllowlist'

describe('the patch flags', () => {
  it.each(['diff', 'diff-index'])(
    'are allowed for %s, with revisions and the separator',
    (command) => {
      expect(() => {
        assertAllowedGitArgs([command, ...PATCH_ARGS, 'abc123', 'def456', '--'])
      }).not.toThrow()
    }
  )

  it('run no external diff or textconv program, and never color the text', () => {
    expect(PATCH_ARGS).toEqual(
      expect.arrayContaining(['--no-ext-diff', '--no-textconv', '--no-color'])
    )
    expect(PATCH_ARGS).not.toContain('--ext-diff')
    expect(PATCH_ARGS).not.toContain('--textconv')
  })

  it('are the exact list the patch read sends', () => {
    expect(PATCH_ARGS).toEqual([
      '--raw',
      '-z',
      '--patch',
      '--no-color',
      '--unified=3',
      '--no-ext-diff',
      '--no-textconv',
      '--find-renames',
      '--ignore-submodules=dirty',
      '--submodule=short',
      '--src-prefix=a/',
      '--dst-prefix=b/'
    ])
  })

  it.each([
    ['merge-base', ['merge-base', '--patch', 'a', 'b']],
    ['rev-parse', ['rev-parse', '--raw', 'HEAD']],
    ['ls-files', ['ls-files', '--patch', '--']]
  ])('are refused for %s', (_name, args) => {
    expect(() => {
      assertAllowedGitArgs(args)
    }).toThrow('git-option-not-allowed')
  })

  it.each([
    ['writing a file', '--output=/tmp/out'],
    ['an external diff', '--ext-diff'],
    ['a textconv program', '--textconv'],
    ['color', '--color'],
    ['a different context size', '--unified=999999'],
    ['submodule history', '--submodule=log'],
    ['submodule contents', '--submodule=diff'],
    ['another prefix', '--src-prefix=x/'],
    ['comparing paths outside a repo', '--no-index'],
    ['a pager', '--open-files-in-pager'],
    ['an order file', '-O/tmp/order']
  ])('leave %s refused', (_what, flag) => {
    expect(() => {
      assertAllowedGitArgs(['diff', ...PATCH_ARGS, flag, 'a', 'b', '--'])
    }).toThrow('git-option-not-allowed')
  })
})
