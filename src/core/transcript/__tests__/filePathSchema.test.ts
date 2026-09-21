import { describe, expect, it } from 'vitest'
import { filePathSchema } from '../schemas/filePath'

describe('filePathSchema', () => {
  it('accepts an ordinary absolute path', () => {
    expect(filePathSchema.safeParse('/repo/src/example.ts').success).toBe(true)
  })

  it('rejects a path longer than the cap', () => {
    expect(filePathSchema.safeParse('/'.repeat(4097)).success).toBe(false)
  })

  it('rejects a non-string value', () => {
    expect(filePathSchema.safeParse(42).success).toBe(false)
  })
})
