import { describe, expect, it } from 'vitest'
import { i18n } from '../i18n'

describe('i18n', () => {
  it('is ready on import with the English resources', () => {
    expect(i18n.isInitialized).toBe(true)
    expect(i18n.t('common:retry')).toBe('Retry')
  })

  it.each(['<b>x</b> &amp;', '{{appName}}', '$t(common:retry)'])(
    'inserts the value %j as plain text',
    (value) => {
      expect(i18n.getFixedT('en-US', 'sessions')('notes.team', { name: value })).toBe(
        `team ${value}`
      )
    }
  )

  it('rejects an unknown key at compile time', () => {
    // @ts-expect-error -- the key does not exist, so typecheck fails without this directive
    expect(i18n.t('common:noSuchKey')).toBe('noSuchKey')
  })
})
