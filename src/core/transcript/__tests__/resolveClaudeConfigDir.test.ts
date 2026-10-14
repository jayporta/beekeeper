import { describe, expect, it } from 'vitest'
import { resolveClaudeConfigDir } from '../resolveClaudeConfigDir'

const HOME = '/home/someone'

describe('resolveClaudeConfigDir', () => {
  it('uses an absolute CLAUDE_CONFIG_DIR over the home folder', () => {
    expect(resolveClaudeConfigDir('/data/claude', HOME)).toBe('/data/claude')
  })

  it('falls back to .claude under the home folder when CLAUDE_CONFIG_DIR is unset', () => {
    expect(resolveClaudeConfigDir(undefined, HOME)).toBe('/home/someone/.claude')
  })

  it('falls back to .claude under the home folder when CLAUDE_CONFIG_DIR is empty', () => {
    expect(resolveClaudeConfigDir('', HOME)).toBe('/home/someone/.claude')
  })

  it('falls back to .claude under the home folder when CLAUDE_CONFIG_DIR is relative', () => {
    expect(resolveClaudeConfigDir('claude-config', HOME)).toBe('/home/someone/.claude')
  })

  it('does not expand a leading ~, which makes the value relative', () => {
    expect(resolveClaudeConfigDir('~/claude-config', HOME)).toBe('/home/someone/.claude')
  })

  it('falls back when CLAUDE_CONFIG_DIR is only whitespace', () => {
    expect(resolveClaudeConfigDir('  ', HOME)).toBe('/home/someone/.claude')
  })

  it('drops a trailing slash', () => {
    expect(resolveClaudeConfigDir('/data/claude/', HOME)).toBe('/data/claude')
  })

  it('collapses dot segments and doubled slashes', () => {
    expect(resolveClaudeConfigDir('/data//claude/../claude-b/./', HOME)).toBe('/data/claude-b')
  })

  it('keeps the filesystem root as it is', () => {
    expect(resolveClaudeConfigDir('/', HOME)).toBe('/')
  })
})
