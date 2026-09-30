import { describe, expect, it } from 'vitest'
import { MAX_IDENTIFIER_CODE_UNITS } from '../../schemas/boundedIdentifier'
import { buildAssistantRecord, buildUserRecord } from '../../testFixtures'
import { createLatestModelObserver } from '../latestModelObserver'
import { recordTimestampMs } from '../recordTimestampMs'

const at = (timestamp: string, model: string): Record<string, unknown> =>
  buildAssistantRecord({ timestamp, model })

function modelAfter(records: readonly Record<string, unknown>[]): string | null {
  const observer = createLatestModelObserver()
  for (const record of records) observer.observe(record, recordTimestampMs(record))
  return observer.model()
}

describe('createLatestModelObserver', () => {
  it('reports null when no assistant record was observed', () => {
    expect(modelAfter([buildUserRecord()])).toBeNull()
  })

  it('takes the model of the record with the largest timestamp, not the last line', () => {
    expect(
      modelAfter([
        at('2026-01-03T00:00:00.000Z', 'model-newest'),
        at('2026-01-02T00:00:00.000Z', 'model-middle'),
        at('2026-01-01T00:00:00.000Z', 'model-oldest')
      ])
    ).toBe('model-newest')
  })

  it('takes the largest timestamp when file order runs forwards', () => {
    expect(
      modelAfter([
        at('2026-01-01T00:00:00.000Z', 'model-oldest'),
        at('2026-01-03T00:00:00.000Z', 'model-newest')
      ])
    ).toBe('model-newest')
  })

  it('keeps the first record seen when two share the largest timestamp', () => {
    expect(
      modelAfter([
        at('2026-01-01T00:00:00.000Z', 'model-first'),
        at('2026-01-01T00:00:00.000Z', 'model-second')
      ])
    ).toBe('model-first')
  })

  it('skips <synthetic> even when it is the latest', () => {
    expect(
      modelAfter([
        at('2026-01-01T00:00:00.000Z', 'model-real'),
        at('2026-01-02T00:00:00.000Z', '<synthetic>')
      ])
    ).toBe('model-real')
  })

  it('reports null when every model is <synthetic>', () => {
    expect(modelAfter([at('2026-01-01T00:00:00.000Z', '<synthetic>')])).toBeNull()
  })

  it.each([
    ['missing', undefined],
    ['a number', 5],
    ['null', null],
    ['empty', '']
  ])('ignores a model that is %s', (_label, model) => {
    const record = buildAssistantRecord({ timestamp: '2026-01-02T00:00:00.000Z' })
    record.message = { model }

    expect(modelAfter([at('2026-01-01T00:00:00.000Z', 'model-real'), record])).toBe('model-real')
  })

  it('ignores an assistant record whose message is not an object', () => {
    const record = buildAssistantRecord({ timestamp: '2026-01-02T00:00:00.000Z' })
    record.message = 'text'

    expect(modelAfter([at('2026-01-01T00:00:00.000Z', 'model-real'), record])).toBe('model-real')
  })

  it('ignores a model over the identifier cap and treats it as absent', () => {
    const tooLong = 'm'.repeat(MAX_IDENTIFIER_CODE_UNITS + 1)

    expect(
      modelAfter([
        at('2026-01-01T00:00:00.000Z', 'model-real'),
        at('2026-01-02T00:00:00.000Z', tooLong)
      ])
    ).toBe('model-real')
    expect(modelAfter([at('2026-01-02T00:00:00.000Z', tooLong)])).toBeNull()
  })

  it('accepts a model exactly at the cap', () => {
    const atCap = 'm'.repeat(MAX_IDENTIFIER_CODE_UNITS)

    expect(modelAfter([at('2026-01-01T00:00:00.000Z', atCap)])).toBe(atCap)
  })

  it('ignores an assistant record with no timestamp, even when it is the only one', () => {
    const record = buildAssistantRecord({ model: 'model-untimed' })
    delete record.timestamp

    expect(modelAfter([record])).toBeNull()
    expect(modelAfter([at('2026-01-01T00:00:00.000Z', 'model-real'), record])).toBe('model-real')
  })

  it.each([
    ['only spaces', '   '],
    ['spaces around a no-break space', ' \u00A0 ']
  ])('ignores a model of %s', (_label, model) => {
    expect(
      modelAfter([
        at('2026-01-01T00:00:00.000Z', 'model-real'),
        at('2026-01-02T00:00:00.000Z', model)
      ])
    ).toBe('model-real')
  })

  it.each([
    ['a bidi override', 'claude\u202Eopus'],
    ['a line separator', 'claude\u2028opus'],
    ['a newline', 'claude\nopus'],
    ['a control character', 'claude\u0007opus']
  ])('ignores a model containing %s, so an earlier clean one wins', (_label, model) => {
    expect(
      modelAfter([
        at('2026-01-01T00:00:00.000Z', 'model-real'),
        at('2026-01-02T00:00:00.000Z', model)
      ])
    ).toBe('model-real')
  })

  it('ignores a sidechain record, which belongs to a subagent, not the lead', () => {
    const sidechain = buildAssistantRecord({
      timestamp: '2026-01-02T00:00:00.000Z',
      model: 'model-subagent',
      extra: { isSidechain: true }
    })

    expect(modelAfter([at('2026-01-01T00:00:00.000Z', 'model-real'), sidechain])).toBe('model-real')
  })

  it('keeps a record whose isSidechain is false', () => {
    const record = buildAssistantRecord({
      timestamp: '2026-01-01T00:00:00.000Z',
      model: 'model-real',
      extra: { isSidechain: false }
    })

    expect(modelAfter([record])).toBe('model-real')
  })

  it('uses the timestamp it is given, not one parsed from the record', () => {
    const observer = createLatestModelObserver()
    observer.observe(at('2026-01-09T00:00:00.000Z', 'model-a'), 1)
    observer.observe(at('2026-01-01T00:00:00.000Z', 'model-b'), 2)

    expect(observer.model()).toBe('model-b')
  })

  it('ignores a record given no timestamp', () => {
    const observer = createLatestModelObserver()
    observer.observe(at('2026-01-01T00:00:00.000Z', 'model-a'), null)

    expect(observer.model()).toBeNull()
  })

  it('ignores a non-assistant record that carries a model', () => {
    const record = buildUserRecord({ extra: { message: { model: 'model-user' } } })

    expect(modelAfter([record])).toBeNull()
  })
})
