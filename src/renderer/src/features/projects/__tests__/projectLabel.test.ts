import { describe, expect, it } from 'vitest'
import { testProject } from '@renderer/testBeekeeperApi'
import { projectLabel } from '../projectLabel'

describe('projectLabel', () => {
  it('is the label read from the transcript when there is one', () => {
    expect(projectLabel({ ...testProject('-Users-a-repo'), label: 'acme-web' })).toBe('acme-web')
  })

  it('falls back to the folder name when there is no label', () => {
    expect(projectLabel(testProject('-Users-a-repo'))).toBe('-Users-a-repo')
  })
})
