import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach } from 'vitest'
import { buildUserToolResultRecord } from '../../transcript/testFileTouchFixtures'
import { buildJsonlText } from '../../transcript/testFixtures'

/** The file the fixtures change unless a test says otherwise. */
export const TEST_DIFF_FILE = '/repo/src/example.ts'

/** A hunk adding one line, as `structuredPatch` records it. */
export function buildHunk(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    oldStart: 1,
    oldLines: 1,
    newStart: 1,
    newLines: 2,
    lines: [' keep', '+added'],
    ...overrides
  }
}

interface ResultOptions {
  readonly toolUseId: string
  readonly filePath?: string
}

/** A user record carrying an Edit result with the given `structuredPatch`. */
export function buildEditResultRecord(
  options: ResultOptions & { structuredPatch?: unknown; userModified?: unknown }
): Record<string, unknown> {
  const { toolUseId, filePath = TEST_DIFF_FILE, structuredPatch, userModified } = options
  return buildUserToolResultRecord({
    toolUseId,
    toolUseResult: {
      filePath,
      ...(structuredPatch !== undefined && { structuredPatch }),
      ...(userModified !== undefined && { userModified })
    }
  })
}

/** A user record carrying a Write result. */
export function buildWriteResultRecord(
  options: ResultOptions & {
    type: 'create' | 'update'
    content?: string
    structuredPatch?: unknown
  }
): Record<string, unknown> {
  const { toolUseId, filePath = TEST_DIFF_FILE, ...rest } = options
  return buildUserToolResultRecord({ toolUseId, toolUseResult: { filePath, ...rest } })
}

/** A user record carrying a Bash result whose `bashEditDiff` holds the given fields. */
export function buildBashResultRecord(options: {
  readonly toolUseId: string
  readonly bashEditDiff: Record<string, unknown>
}): Record<string, unknown> {
  return buildUserToolResultRecord({
    toolUseId: options.toolUseId,
    toolUseResult: { stdout: 'ok', bashEditDiff: options.bashEditDiff }
  })
}

/** Writes synthetic transcripts into temp folders removed after each test. */
export interface TranscriptWriter {
  /**
   * Writes the records as a transcript.
   * @param lines - The records, or raw text lines, in file order.
   * @returns The transcript's path.
   */
  readonly write: (lines: readonly unknown[]) => Promise<string>
}

/** Registers the cleanup hook for {@link TranscriptWriter}. Call once at the top of a test file. */
export function registerTranscriptWriter(): TranscriptWriter {
  const dirs: string[] = []
  afterEach(async () => {
    await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
  })
  return {
    write: async (lines) => {
      const dir = await mkdtemp(join(tmpdir(), 'beekeeper-filediff-'))
      dirs.push(dir)
      const path = join(dir, 'transcript.jsonl')
      const text = lines
        .map((line) => (typeof line === 'string' ? `${line}\n` : buildJsonlText([line])))
        .join('')
      await writeFile(path, text)
      return path
    }
  }
}
