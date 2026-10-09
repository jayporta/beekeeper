import { describe, expect, it } from 'vitest'
import { parseArchivedDetail, parseArchivedListItem } from '../parseArchivedRow'
import { testDetail, testListItem, testOkSummary, TEST_REF } from '../testArchiveFixtures'

/** A list item the archive would hold: a readable summary and no team. */
function storedItem(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    ...testListItem({ summary: testOkSummary(5) }),
    team: null,
    ...overrides
  })
}

function storedDetail(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({ ...testDetail(), ...overrides })
}

describe('parseArchivedListItem', () => {
  it('returns the item a row holds', () => {
    const result = parseArchivedListItem(storedItem(), TEST_REF)

    expect(result).toEqual({
      ok: true,
      value: { ...testListItem({ summary: testOkSummary(5) }), team: null }
    })
  })

  it('tolerates fields it does not know', () => {
    const result = parseArchivedListItem(storedItem({ futureField: { nested: true } }), TEST_REF)

    expect(result.ok).toBe(true)
  })

  it('tolerates a title and an activity of null', () => {
    const summary = { ok: true, value: { title: null, activity: null } }

    expect(parseArchivedListItem(storedItem({ summary }), TEST_REF).ok).toBe(true)
  })

  it('rejects text that is not JSON', () => {
    expect(parseArchivedListItem('{"projectDirName":', TEST_REF)).toEqual({
      ok: false,
      error: 'invalid-json'
    })
  })

  it.each([
    ['null', 'null'],
    ['an array', '[]'],
    ['a string', '"text"']
  ])('rejects JSON that is %s', (_label, json) => {
    expect(parseArchivedListItem(json, TEST_REF)).toEqual({ ok: false, error: 'invalid-shape' })
  })

  it('rejects a numeric title', () => {
    const summary = { ok: true, value: { title: 42, activity: null } }

    expect(parseArchivedListItem(storedItem({ summary }), TEST_REF)).toEqual({
      ok: false,
      error: 'invalid-shape'
    })
  })

  it('rejects a summary that was not readable', () => {
    const summary = { ok: false, value: { title: null, activity: null } }

    expect(parseArchivedListItem(storedItem({ summary }), TEST_REF)).toEqual({
      ok: false,
      error: 'invalid-shape'
    })
  })

  it('rejects an activity whose times are not numbers', () => {
    const summary = { ok: true, value: { title: null, activity: { earliestMs: 'a', latestMs: 1 } } }

    expect(parseArchivedListItem(storedItem({ summary }), TEST_REF).ok).toBe(false)
  })

  it('rejects a modification time that is not a number or null', () => {
    expect(parseArchivedListItem(storedItem({ modifiedMs: '1000' }), TEST_REF).ok).toBe(false)
  })

  it.each([
    ['missing agent terms', { agentTerms: undefined }],
    ['agent terms that are not a list', { agentTerms: 'x' }],
    ['missing workflow run names', { workflowRunNames: undefined }],
    ['workflow run names that are not a list', { workflowRunNames: 'x' }],
    ['workflow run names that are not text', { workflowRunNames: [1] }]
  ])('rejects a row with %s', (_label, overrides) => {
    expect(parseArchivedListItem(storedItem(overrides), TEST_REF)).toEqual({
      ok: false,
      error: 'invalid-shape'
    })
  })

  it('rejects a project folder name that could be a path', () => {
    const json = storedItem({ projectDirName: '../escape' })

    expect(parseArchivedListItem(json, { ...TEST_REF, projectDirName: '../escape' })).toEqual({
      ok: false,
      error: 'invalid-shape'
    })
  })

  it('rejects a session id that is not a lowercase UUID', () => {
    const json = storedItem({ sessionId: 'not-a-uuid' })

    expect(parseArchivedListItem(json, { ...TEST_REF, sessionId: 'not-a-uuid' }).ok).toBe(false)
  })

  it('rejects a row whose folder differs from its key', () => {
    const json = storedItem({ projectDirName: '-other' })

    expect(parseArchivedListItem(json, TEST_REF)).toEqual({ ok: false, error: 'key-mismatch' })
  })

  it('rejects a row whose session id differs from its key', () => {
    const json = storedItem({ sessionId: '22222222-2222-4222-8222-222222222222' })

    expect(parseArchivedListItem(json, TEST_REF)).toEqual({ ok: false, error: 'key-mismatch' })
  })
})

describe('parseArchivedDetail', () => {
  it('returns the detail a row holds', () => {
    expect(parseArchivedDetail(storedDetail(), TEST_REF)).toEqual({ ok: true, value: testDetail() })
  })

  it('tolerates fields it does not know', () => {
    expect(parseArchivedDetail(storedDetail({ futureField: [1, 2] }), TEST_REF).ok).toBe(true)
  })

  it('rejects text that is not JSON', () => {
    expect(parseArchivedDetail('nope', TEST_REF)).toEqual({ ok: false, error: 'invalid-json' })
  })

  it('rejects a detail without a lead', () => {
    expect(parseArchivedDetail(storedDetail({ lead: undefined }), TEST_REF)).toEqual({
      ok: false,
      error: 'invalid-shape'
    })
  })

  it('rejects a detail without a tree', () => {
    expect(parseArchivedDetail(storedDetail({ tree: null }), TEST_REF).ok).toBe(false)
  })

  it('rejects a session id that differs from its key', () => {
    const json = storedDetail({ sessionId: '22222222-2222-4222-8222-222222222222' })

    expect(parseArchivedDetail(json, TEST_REF)).toEqual({ ok: false, error: 'key-mismatch' })
  })

  it('rejects a numeric session id', () => {
    expect(parseArchivedDetail(storedDetail({ sessionId: 7 }), TEST_REF).ok).toBe(false)
  })
})
