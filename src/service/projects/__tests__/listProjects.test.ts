import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildDiscoveryTree } from '../../../core/transcript/testDiscoveryTree'
import { buildCwdRecord, buildJsonlText } from '../../../core/transcript/testFixtures'
import { createServiceDeps } from '../../createServiceDeps'
import { TEST_PROJECT, TEST_SESSION_ID, registerServiceTestTree } from '../../testServiceTree'
import { listProjects } from '../listProjects'

const ctx = registerServiceTestTree()

describe('listProjects', () => {
  it('lists project folder names and nothing else', async () => {
    expect(await listProjects(ctx.deps)).toEqual({
      ok: true,
      value: [{ dirName: TEST_PROJECT, label: null, worktreeOf: null, worktreeName: null }]
    })
  })

  it('labels a project with the last segment of its recorded cwd', async () => {
    const labelled = await buildDiscoveryTree({
      files: {
        [`.claude/projects/${TEST_PROJECT}/${TEST_SESSION_ID}.jsonl`]: buildJsonlText([
          buildCwdRecord('/Users/test/acme-web')
        ])
      }
    })
    try {
      const result = await listProjects(
        createServiceDeps(join(labelled.root, '.claude', 'projects'))
      )

      expect(result).toEqual({
        ok: true,
        value: [{ dirName: TEST_PROJECT, label: 'acme-web', worktreeOf: null, worktreeName: null }]
      })
    } finally {
      await labelled.cleanup()
    }
  })

  it('returns an empty list when the projects root does not exist', async () => {
    const result = await listProjects(createServiceDeps(join(ctx.tree.home, 'nowhere')))
    expect(result).toEqual({ ok: true, value: [] })
  })
})
