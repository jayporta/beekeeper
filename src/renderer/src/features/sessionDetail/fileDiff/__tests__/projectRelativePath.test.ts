import { describe, expect, it } from 'vitest'
import { projectRelativePath } from '../projectRelativePath'

describe('projectRelativePath', () => {
  it('starts the path at the project folder', () => {
    expect(projectRelativePath('/home/dev/code/app/src/a.ts', 'app')).toBe('app/src/a.ts')
  })

  it('starts at the first folder with the label, not a deeper one', () => {
    expect(projectRelativePath('/home/dev/app/src/app/a.ts', 'app')).toBe('app/src/app/a.ts')
  })

  it('keeps the whole path when no folder matches the label', () => {
    expect(projectRelativePath('/home/dev/other/a.ts', 'app')).toBe('/home/dev/other/a.ts')
  })

  it('does not match a folder whose name only contains the label', () => {
    expect(projectRelativePath('/home/dev/my-app/a.ts', 'app')).toBe('/home/dev/my-app/a.ts')
  })

  it('keeps the whole path when the label is unknown', () => {
    expect(projectRelativePath('/home/dev/app/a.ts', null)).toBe('/home/dev/app/a.ts')
  })
})
