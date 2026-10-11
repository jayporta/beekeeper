import { describe, expect, it } from 'vitest'
import { errorWithCode } from '../../../core/shared/testErrorWithCode'
import type { SessionRefDto } from '../../../shared/ipc/sessionRefDto'
import { createFakeArchive } from '../../../service/archive/testFakeArchive'
import { guardArchive } from '../guardArchive'
import { testDetail } from '../testArchiveFixtures'
import { collectLog } from '../testCollectLog'

const ref: SessionRefDto = { projectDirName: '-p', sessionId: 's' }
const source = { mtimeMs: 1, size: 1 }
const detail = testDetail()

describe('guardArchive', () => {
  it('answers reads from the store when it works', () => {
    const { lines, log } = collectLog()
    const archive = guardArchive(createFakeArchive(undefined, { details: new Map() }), log)

    expect(archive.readSessions('-p', new Set())).toEqual([])
    expect(archive.readDetail(ref)).toBeNull()
    expect(lines).toEqual([])
  })

  it('answers an empty list when reading sessions throws, logging once', () => {
    const { lines, log } = collectLog()
    const archive = guardArchive(createFakeArchive(errorWithCode('EGUARDARCHIVE_SESSIONS')), log)

    expect(archive.readSessions('-p', new Set())).toEqual([])
    expect(archive.readSessions('-p', new Set())).toEqual([])
    expect(lines).toEqual(['Beekeeper archive read failed (EGUARDARCHIVE_SESSIONS).'])
  })

  it('answers null when reading lead slots throws', () => {
    const { lines, log } = collectLog()
    const archive = guardArchive(createFakeArchive(errorWithCode('EGUARDARCHIVE_SLOTS')), log)

    expect(archive.readLeadSlots(ref)).toBeNull()
    expect(lines).toEqual(['Beekeeper archive read failed (EGUARDARCHIVE_SLOTS).'])
  })

  it('answers null when reading a detail throws', () => {
    const { lines, log } = collectLog()
    const archive = guardArchive(createFakeArchive(errorWithCode('EGUARDARCHIVE_DETAIL')), log)

    expect(archive.readDetail(ref)).toBeNull()
    expect(lines).toEqual(['Beekeeper archive read failed (EGUARDARCHIVE_DETAIL).'])
  })

  it('skips a list item write that throws, logging it as a write', () => {
    const { lines, log } = collectLog()
    const archive = guardArchive(createFakeArchive(errorWithCode('EGUARDARCHIVE_LIST')), log)

    expect(() => archive.saveListItems([])).not.toThrow()
    expect(lines).toEqual(['Beekeeper archive write failed (EGUARDARCHIVE_LIST).'])
  })

  it('skips a detail write that throws', () => {
    const { lines, log } = collectLog()
    const archive = guardArchive(createFakeArchive(errorWithCode('EGUARDARCHIVE_SAVE')), log)

    expect(() => archive.saveDetail(ref, { detail, source })).not.toThrow()
    expect(lines).toEqual(['Beekeeper archive write failed (EGUARDARCHIVE_SAVE).'])
  })

  it('passes writes through to the store when it works', () => {
    const fake = createFakeArchive()
    const archive = guardArchive(fake, collectLog().log)

    archive.saveDetail(ref, { detail, source })

    expect(fake.detailSaves).toHaveLength(1)
  })
})
