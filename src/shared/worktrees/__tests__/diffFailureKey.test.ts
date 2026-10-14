import { describe, expect, it } from 'vitest'
import { diffFailureKey } from '../diffFailureKey'

describe('diffFailureKey', () => {
  it.each([
    ['branch-not-found', 'branchMissing'],
    ['repo-missing', 'repoMissing'],
    ['not-a-repo', 'repoMissing'],
    ['outside-project', 'repoMissing'],
    ['invalid-path', 'repoMissing'],
    ['invalid-ref', 'failed'],
    ['output-too-large', 'tooLarge'],
    ['timeout', 'timeout'],
    ['too-many-agents', 'tooMany'],
    ['no-base', 'noBase'],
    ['no-common-ancestor', 'noBase'],
    ['git-failed', 'failed'],
    ['malformed-numstat', 'failed'],
    ['spawn-failed', 'failed']
  ] as const)('maps %s to %s', (code, key) => {
    expect(diffFailureKey(code)).toBe(key)
  })
})
