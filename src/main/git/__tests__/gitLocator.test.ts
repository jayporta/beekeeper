import { describe, expect, it, vi } from 'vitest'
import { toGitBinary } from '../../../core/git/gitBinary'
import { err, ok } from '../../../core/transcript/result'
import { createGitLocator, type GitLocation } from '../gitLocator'

const found: GitLocation = ok(toGitBinary('/opt/homebrew/bin/git'))

describe('createGitLocator', () => {
  it('retries after a failed lookup', async () => {
    const locate = vi
      .fn<() => Promise<GitLocation>>()
      .mockResolvedValueOnce(err('git-not-found'))
      .mockResolvedValueOnce(found)
    const getGit = createGitLocator(locate)

    expect(await getGit()).toEqual(err('git-not-found'))
    expect(await getGit()).toEqual(found)
    expect(locate).toHaveBeenCalledTimes(2)
  })

  it('remembers a found binary', async () => {
    const locate = vi.fn<() => Promise<GitLocation>>().mockResolvedValue(found)
    const getGit = createGitLocator(locate)

    await getGit()
    await getGit()

    expect(locate).toHaveBeenCalledTimes(1)
  })

  it('shares one in-flight lookup', async () => {
    const locate = vi.fn<() => Promise<GitLocation>>().mockResolvedValue(found)
    const getGit = createGitLocator(locate)

    await Promise.all([getGit(), getGit()])

    expect(locate).toHaveBeenCalledTimes(1)
  })
})
