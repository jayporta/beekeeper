import { describe, expect, it } from 'vitest'
import { meetsMinimumVersion } from '../meetsMinimumVersion'

const MINIMUM = '2.1.296'

describe('meetsMinimumVersion', () => {
  it.each(['2.1.296', '2.1.300', '2.1.1000', '2.10.0', '2.2.0', '3.0.0'])(
    'accepts %s',
    (version) => {
      expect(meetsMinimumVersion({ version }, MINIMUM)).toBe(true)
    }
  )

  it.each(['2.1.295', '2.1.29', '1.9.999'])('rejects %s', (version) => {
    expect(meetsMinimumVersion({ version }, MINIMUM)).toBe(false)
  })

  it('counts a dev build of the minimum as meeting it', () => {
    const dev = { version: '2.1.296-dev.20261001.t1.sha1', base: '2.1.296-dev' }

    expect(meetsMinimumVersion(dev, MINIMUM)).toBe(true)
  })

  it('reads the numeric core of the version when there is no base', () => {
    expect(meetsMinimumVersion({ version: '2.1.296-dev.20261001' }, MINIMUM)).toBe(true)
  })

  it('rejects a version with no numeric core', () => {
    expect(meetsMinimumVersion({ version: 'unknown' }, MINIMUM)).toBe(false)
  })
})
