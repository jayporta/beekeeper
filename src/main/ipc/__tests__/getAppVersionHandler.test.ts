import { describe, expect, it } from 'vitest'
import { getAppVersionHandler } from '../getAppVersionHandler'

describe('getAppVersionHandler', () => {
  it('returns the app version', async () => {
    expect(await getAppVersionHandler({ appVersion: '0.1.0' })).toEqual({
      ok: true,
      value: '0.1.0'
    })
  })

  it('reports an internal error when the app set no version', async () => {
    expect(await getAppVersionHandler({ appVersion: null })).toEqual({
      ok: false,
      error: { code: 'internal' }
    })
  })
})
