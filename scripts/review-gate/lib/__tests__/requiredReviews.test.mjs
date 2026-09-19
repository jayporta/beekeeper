import { describe, expect, it } from 'vitest'
import { requiredReviews } from '../reviewScope.mjs'

describe('requiredReviews', () => {
  it('needs nothing for a docs-only diff', () => {
    expect(requiredReviews(['README.md'])).toEqual([])
  })

  it('needs only a code review for a test-only diff', () => {
    expect(requiredReviews(['src/main/security/__tests__/session.test.ts'])).toEqual([
      'code-review'
    ])
  })

  it('needs code review and accessibility for a renderer CSS file', () => {
    expect(requiredReviews(['src/renderer/src/App.css'])).toEqual(['code-review', 'accessibility'])
  })

  it('needs all three reviews for a renderer TSX file', () => {
    expect(requiredReviews(['src/renderer/src/App.tsx'])).toEqual([
      'code-review',
      'security',
      'accessibility'
    ])
  })

  it('needs code review and security for a main-process file', () => {
    expect(requiredReviews(['src/main/index.ts'])).toEqual(['code-review', 'security'])
  })

  it('needs code review and security for package.json', () => {
    expect(requiredReviews(['package.json'])).toEqual(['code-review', 'security'])
  })

  it('needs code review and security for the pre-commit hook entry', () => {
    expect(requiredReviews(['scripts/review-gate/preCommit.mjs'])).toEqual([
      'code-review',
      'security'
    ])
  })

  it('needs only a code review for a review-gate test file', () => {
    expect(requiredReviews(['scripts/review-gate/lib/__tests__/reviewScope.test.mjs'])).toEqual([
      'code-review'
    ])
  })

  it('needs code review and security for the git hooks shim', () => {
    expect(requiredReviews(['.githooks/pre-commit'])).toEqual(['code-review', 'security'])
  })

  it('needs code review and security for the Claude Code guard hook', () => {
    expect(requiredReviews(['.claude/hooks/block-hook-bypass.mjs'])).toEqual([
      'code-review',
      'security'
    ])
  })

  it('needs code review and security for an agent definition under .claude/agents/', () => {
    expect(requiredReviews(['.claude/agents/code-reviewer.md'])).toEqual([
      'code-review',
      'security'
    ])
  })

  it('needs nothing for a skill file under .claude/skills/', () => {
    expect(requiredReviews(['.claude/skills/doc-comments/SKILL.md'])).toEqual([])
  })

  it('needs code review and security for .gitattributes', () => {
    expect(requiredReviews(['.gitattributes'])).toEqual(['code-review', 'security'])
  })

  it('needs code review and security for .npmrc', () => {
    expect(requiredReviews(['.npmrc'])).toEqual(['code-review', 'security'])
  })

  it('needs code review and security for vitest.config.ts', () => {
    expect(requiredReviews(['vitest.config.ts'])).toEqual(['code-review', 'security'])
  })

  it('needs code review and security for tsconfig.node.json', () => {
    expect(requiredReviews(['tsconfig.node.json'])).toEqual(['code-review', 'security'])
  })

  it('needs code review and security for a file under resources/', () => {
    expect(requiredReviews(['resources/icon.png'])).toEqual(['code-review', 'security'])
  })

  it('unions the reviews required across a mixed set of paths', () => {
    const paths = ['README.md', 'src/main/index.ts', 'src/renderer/src/App.css']
    expect(requiredReviews(paths)).toEqual(['code-review', 'security', 'accessibility'])
  })
})
