import { describe, expect, it } from 'vitest'
import { canClearOnceQuiet, isTransientMetaFailure } from '../metaFailureTransience'
import type { SubagentMetaFailureReason } from '../subagentMetaStatus'

describe('isTransientMetaFailure', () => {
  it.each<[SubagentMetaFailureReason, boolean]>([
    ['unreadable', true],
    ['missing', true],
    ['invalid-json', true],
    ['invalid-shape', false],
    ['too-large', false],
    ['symlink', false],
    ['not-a-file', false]
  ])('classifies %s as transient: %s', (reason, expected) => {
    expect(isTransientMetaFailure(reason)).toBe(expected)
  })
})

describe('canClearOnceQuiet', () => {
  it.each<[SubagentMetaFailureReason, boolean]>([
    ['unreadable', true],
    ['missing', true],
    ['invalid-json', false],
    ['invalid-shape', false],
    ['too-large', false],
    ['symlink', false],
    ['not-a-file', false]
  ])('classifies %s as able to clear once quiet: %s', (reason, expected) => {
    expect(canClearOnceQuiet(reason)).toBe(expected)
  })
})
