import { appendFileSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { LineScan } from '../feedLineScan'
import {
  RESUME_ENTRY_OVERHEAD,
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
  touch(1_800_000_001)
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
    touch(1_800_000_002)
    const resumed = await resumeScan({ file: await statWrittenTranscript(path), resume })

    expect(resumed?.scan).toBe(resume.scan)
    expect(resumed?.scan.seen).toEqual([1, 2, 3, 4])
  })

  it('reports the new stat and the new offset', async () => {
    const resume = await started(lines(1))

    appendFileSync(path, lines(2))
    touch(1_800_000_002)
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
      touch(1_800_000_002)
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
        Object.assign(resume, { mtimeMs: 1_800_000_002_000 })
      })

      expect(seen).toEqual([1])
    })

    it('when the size is below what the scan consumed', async () => {
      const resume = await started(lines(1))
      Object.assign(resume, { size: resume.offset - 5 })
      appendFileSync(path, lines(2))
      touch(1_800_000_002)
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
