import { describe, expect, it } from 'vitest'
import { looksLikeHookBypass } from '../block-hook-bypass.mjs'

describe('looksLikeHookBypass', () => {
  it('blocks git commit --no-verify', () => {
    expect(looksLikeHookBypass('git commit --no-verify -m x')).toBe(true)
  })

  it('blocks an abbreviated --no-v, since git accepts unambiguous prefixes', () => {
    expect(looksLikeHookBypass('git commit --no-v -m x')).toBe(true)
  })

  it('blocks core.hooksPath regardless of case', () => {
    expect(looksLikeHookBypass('git config core.HOOKSPATH x')).toBe(true)
  })

  it('blocks --no-hooks', () => {
    expect(looksLikeHookBypass('git commit --no-hooks -m x')).toBe(true)
  })

  it('blocks git am, since git never runs pre-commit for it', () => {
    expect(looksLikeHookBypass('git am patch.mbox')).toBe(true)
  })

  it('blocks am as the subcommand behind a global option like -C', () => {
    expect(looksLikeHookBypass('git -C x am p')).toBe(true)
  })

  it('blocks git am chained after another git command', () => {
    expect(looksLikeHookBypass('git status && git am patch.mbox')).toBe(true)
  })

  it('allows a commit message that merely contains the word am', () => {
    expect(looksLikeHookBypass('git commit -m "note what I am changing"')).toBe(false)
  })

  it('allows -am, since it has no n and am is not the subcommand', () => {
    expect(looksLikeHookBypass('git commit -am x')).toBe(false)
  })

  it('allows am as an unrelated word after a different command', () => {
    expect(looksLikeHookBypass('git status && echo am')).toBe(false)
  })

  it('blocks git commit-tree, since git never runs pre-commit for it', () => {
    expect(looksLikeHookBypass('git commit-tree HEAD^{tree} -m x')).toBe(true)
  })

  it('blocks a chmod touching .githooks', () => {
    expect(looksLikeHookBypass('chmod -x .githooks/pre-commit')).toBe(true)
  })

  it('blocks git commit -nm, a short cluster carrying -n', () => {
    expect(looksLikeHookBypass('git commit -nm x')).toBe(true)
  })

  it('blocks a -n flag bounded by a quote on one side, like -nm’x’', () => {
    expect(looksLikeHookBypass(`git commit -nm'x'`)).toBe(true)
  })

  it('blocks a -n flag wrapped entirely in quotes, like "-n"', () => {
    expect(looksLikeHookBypass('git commit "-n" -m x')).toBe(true)
  })

  it('blocks a -n flag bounded by = on one side, like -nmx=y', () => {
    expect(looksLikeHookBypass('git commit -nmx=y')).toBe(true)
  })

  it('allows git log -n 5, since it has no commit word', () => {
    expect(looksLikeHookBypass('git log -n 5')).toBe(false)
  })

  it('allows git status', () => {
    expect(looksLikeHookBypass('git status')).toBe(false)
  })
})
