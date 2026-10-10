import { appendFileSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createLruMap, type LruMap } from '../../shared/lruMap'
import type { LineScan } from '../feedLineScan'
import {
  advanceScan,
  RESUME_ENTRY_OVERHEAD,
  RESUME_RECENT_MS,
  resumableScanWeight,
  resumeScan,
  startScan,
  type ResumableScan
} from '../resumableScan'
import { statWrittenTranscript } from '../testStatTranscript'

/** A scan that keeps the `n` of every record, and weighs one unit for each. */
interface NumberScan extends LineScan {
  readonly seen: number[]
}

function createNumberScan(): NumberScan {
  const seen: number[] = []
  return {
    seen,
    observe(input) {
      if (input.ok && typeof input.value['n'] === 'number') seen.push(input.value['n'])
    },
    weight: () => seen.length
  }
}

/** The time the tests start, in seconds, so the files they touch count as recently modified. */
const BASE_SECONDS = Math.floor(Date.now() / 1000)

let dir: string
let path: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'beekeeper-resumable-'))
  path = join(dir, 'session.jsonl')
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

const lines = (...numbers: number[]): string => numbers.map((n) => `{"n":${n}}\n`).join('')

/** Moves the file's modification time to a distinct second, so a stat tells it from the last. */
function touch(seconds: number): void {
  utimesSync(path, seconds, seconds)
}

async function started(content: string): Promise<ResumableScan<NumberScan>> {
  writeFileSync(path, content)
  touch(BASE_SECONDS + 1)
  return startScan({ file: await statWrittenTranscript(path), scan: createNumberScan() })
}

describe('startScan', () => {
  it('reads every complete line and reports the offset it consumed through', async () => {
    const resume = await started(`${lines(1, 2)}{"n":3`)

    expect({ seen: resume.scan.seen, offset: resume.offset }).toEqual({
      seen: [1, 2],
      offset: Buffer.byteLength(lines(1, 2))
    })
  })

  it('records the file state it read', async () => {
    const resume = await started(lines(1))
    const file = await statWrittenTranscript(path)

    expect({ mtimeMs: resume.mtimeMs, size: resume.size, ino: resume.mark.ino }).toEqual({
      mtimeMs: file.mtimeMs,
      size: file.size,
      ino: file.ino
    })
  })

  it('rejects with the system error code when the file is gone', async () => {
    await started(lines(1))
    const file = await statWrittenTranscript(path)
    rmSync(path)

    await expect(startScan({ file, scan: createNumberScan() })).rejects.toMatchObject({
      code: 'ENOENT'
    })
  })
})

describe('resumeScan', () => {
  it('feeds the same scan only the lines after the offset', async () => {
    const resume = await started(`${lines(1, 2)}{"n":3`)

    appendFileSync(path, '}\n{"n":4}\n')
    touch(BASE_SECONDS + 2)
    const resumed = await resumeScan({ file: await statWrittenTranscript(path), resume })

    expect(resumed?.scan).toBe(resume.scan)
    expect(resumed?.scan.seen).toEqual([1, 2, 3, 4])
  })

  it('reports the new stat and the new offset', async () => {
    const resume = await started(lines(1))

    appendFileSync(path, lines(2))
    touch(BASE_SECONDS + 2)
    const file = await statWrittenTranscript(path)
    const resumed = await resumeScan({ file, resume })

    expect({ mtimeMs: resumed?.mtimeMs, size: resumed?.size, offset: resumed?.offset }).toEqual({
      mtimeMs: file.mtimeMs,
      size: file.size,
      offset: Buffer.byteLength(lines(1, 2))
    })
  })

  describe('declines, leaving the scan untouched', () => {
    async function declined(
      change: (resume: ResumableScan<NumberScan>) => void
    ): Promise<number[]> {
      const resume = await started(lines(1))
      appendFileSync(path, lines(2))
      touch(BASE_SECONDS + 2)
      const file = await statWrittenTranscript(path)
      change(resume)
      const result = await resumeScan({ file, resume })
      expect(result).toBeNull()
      return resume.scan.seen
    }

    it('when the size did not grow past the one scanned', async () => {
      const seen = await declined((resume) => {
        Object.assign(resume, { size: resume.size + 100 })
      })

      expect(seen).toEqual([1])
    })

    it('when the modification time did not change', async () => {
      const seen = await declined((resume) => {
        Object.assign(resume, { mtimeMs: (BASE_SECONDS + 2) * 1000 })
      })

      expect(seen).toEqual([1])
    })

    it('when the size is below what the scan consumed', async () => {
      const resume = await started(lines(1))
      Object.assign(resume, { size: resume.offset - 5 })
      appendFileSync(path, lines(2))
      touch(BASE_SECONDS + 2)
      const file = { ...(await statWrittenTranscript(path)), size: resume.offset - 1 }

      expect(await resumeScan({ file, resume })).toBeNull()
      expect(resume.scan.seen).toEqual([1])
    })

    it('when the file is not the one that was scanned', async () => {
      const seen = await declined((resume) => {
        Object.assign(resume, { mark: { ...resume.mark, ino: resume.mark.ino + 1 } })
      })

      expect(seen).toEqual([1])
    })
  })
})

describe('resumableScanWeight', () => {
  it('is the entry overhead, the scan, and half the prefix bytes', async () => {
    const resume = await started(lines(1, 2))

    expect(resumableScanWeight(resume)).toBe(
      RESUME_ENTRY_OVERHEAD + 2 + Math.ceil(Buffer.byteLength(lines(1, 2)) / 2)
    )
  })
})

describe('advanceScan', () => {
  type NumberStates = LruMap<string, ResumableScan<NumberScan>>

  function createStates(): NumberStates {
    return createLruMap<string, ResumableScan<NumberScan>>({
      maxWeight: 1_000_000,
      weigh: resumableScanWeight
    })
  }

  async function advance(states: NumberStates, now: () => number = Date.now): Promise<NumberScan> {
    return advanceScan({
      states,
      key: path,
      file: await statWrittenTranscript(path),
      createScan: createNumberScan,
      now
    })
  }

  it('reads a file it holds no scan for from its first byte, and keeps the scan', async () => {
    writeFileSync(path, lines(1, 2))
    touch(BASE_SECONDS + 1)
    const states = createStates()

    const scan = await advance(states)

    expect({ seen: scan.seen, kept: states.size }).toEqual({ seen: [1, 2], kept: 1 })
  })

  it('carries the kept scan on over what the file gained', async () => {
    writeFileSync(path, lines(1))
    touch(BASE_SECONDS + 1)
    const states = createStates()
    const first = await advance(states)

    appendFileSync(path, lines(2))
    touch(BASE_SECONDS + 2)
    const second = await advance(states)

    expect(second).toBe(first)
    expect(second.seen).toEqual([1, 2])
  })

  it('scans a file from its first byte when the kept scan cannot be carried on', async () => {
    writeFileSync(path, lines(1, 2))
    touch(BASE_SECONDS + 1)
    const states = createStates()
    await advance(states)

    writeFileSync(path, lines(7))
    touch(BASE_SECONDS + 2)
    const scan = await advance(states)

    expect(scan.seen).toEqual([7])
  })

  it('keeps no scan for a file not modified within the recent window', async () => {
    writeFileSync(path, lines(1, 2))
    touch(BASE_SECONDS + 1)
    const states = createStates()
    const fileTimeMs = (BASE_SECONDS + 1) * 1000

    const scan = await advance(states, () => fileTimeMs + RESUME_RECENT_MS + 1)

    expect({ seen: scan.seen, kept: states.size }).toEqual({ seen: [1, 2], kept: 0 })
  })

  it('keeps the scan of a file modified exactly the window ago', async () => {
    writeFileSync(path, lines(1))
    touch(BASE_SECONDS + 1)
    const states = createStates()
    const fileTimeMs = (BASE_SECONDS + 1) * 1000

    await advance(states, () => fileTimeMs + RESUME_RECENT_MS)

    expect(states.size).toBe(1)
  })

  it('drops the kept scan once the file is no longer recent', async () => {
    writeFileSync(path, lines(1))
    touch(BASE_SECONDS + 1)
    const states = createStates()
    await advance(states)

    appendFileSync(path, lines(2))
    touch(BASE_SECONDS + 2)
    await advance(states, () => (BASE_SECONDS + 2) * 1000 + RESUME_RECENT_MS + 1)

    expect(states.size).toBe(0)
  })

  it('removes the kept scan when the read fails', async () => {
    writeFileSync(path, lines(1))
    touch(BASE_SECONDS + 1)
    const states = createStates()
    await advance(states)

    appendFileSync(path, lines(2))
    touch(BASE_SECONDS + 2)
    const file = await statWrittenTranscript(path)
    rmSync(path)

    await expect(
      advanceScan({ states, key: path, file, createScan: createNumberScan, now: Date.now })
    ).rejects.toMatchObject({ code: 'ENOENT' })
    expect(states.size).toBe(0)
  })
})
