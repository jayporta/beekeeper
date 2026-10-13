import { describe, expect, it } from 'vitest'
import { MAX_PATH_CODE_UNITS } from '../../shared/boundedPath'
import { filePathSchema } from '../schemas/filePath'

describe('filePathSchema', () => {
  it('accepts an ordinary absolute path', () => {
    expect(filePathSchema.safeParse('/repo/src/example.ts').success).toBe(true)
  })

  it('accepts a relative path, since the cap is the only check', () => {
    expect(filePathSchema.safeParse('src/example.ts').success).toBe(true)
  })

  it('accepts a path of exactly the cap', () => {
    expect(filePathSchema.safeParse('/'.repeat(MAX_PATH_CODE_UNITS)).success).toBe(true)
  })

  it('rejects a path longer than the cap', () => {
    expect(filePathSchema.safeParse('/'.repeat(MAX_PATH_CODE_UNITS + 1)).success).toBe(false)
  })

  it('rejects a non-BMP path under the code-point cap but over the code-unit cap', () => {
    // 3000 non-BMP characters: 3000 code points, but 6000 UTF-16 code units.
    expect(filePathSchema.safeParse('😀'.repeat(3000)).success).toBe(false)
  })

  it('rejects a non-string value', () => {
    expect(filePathSchema.safeParse(42).success).toBe(false)
  })
})
