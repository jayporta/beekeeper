import 'fake-indexeddb/auto'
import { get } from 'idb-keyval'
import { describe, expect, it } from 'vitest'
import { idbStorage } from '../idbStorage'

describe('idbStorage', () => {
  it('reads back what it wrote', async () => {
    await idbStorage.setItem('round-trip', '{"a":1}')

    expect(await idbStorage.getItem('round-trip')).toBe('{"a":1}')
  })

  it('overwrites an existing value', async () => {
    await idbStorage.setItem('overwrite', 'one')
    await idbStorage.setItem('overwrite', 'two')

    expect(await idbStorage.getItem('overwrite')).toBe('two')
  })

  it('reports null for a key that was never written', async () => {
    expect(await idbStorage.getItem('never-written')).toBeNull()
  })

  it('reports null after a key is removed', async () => {
    await idbStorage.setItem('removed', 'x')
    await idbStorage.removeItem('removed')

    expect(await idbStorage.getItem('removed')).toBeNull()
  })

  it('keeps its data out of the default idb-keyval store', async () => {
    await idbStorage.setItem('dedicated', 'x')

    expect(await get('dedicated')).toBeUndefined()
  })
})
