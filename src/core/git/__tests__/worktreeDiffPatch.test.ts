import { chmod, access, rm, symlink } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PATCH_ARGS } from '../gitAllowlist'
import type { GitBinary } from '../gitBinary'
import { registerTestGit, type TestRepo } from '../testGitRepo'
import { worktreeDiffPatch } from '../worktreeDiffPatch'
import { worktreeDiffStat, type WorktreeDiffStatOptions } from '../worktreeDiffStat'
import { registerGitSpies } from '../testGitSpy'

const testGit = registerTestGit()
const spies = registerGitSpies()

function options(
  git: GitBinary,
  repo: TestRepo,
  extra: Partial<WorktreeDiffStatOptions> = {}
): WorktreeDiffStatOptions {
  return { git, repoDir: repo.dir, baseSha: repo.sha('main'), agentBranch: 'agent', ...extra }
}

async function commitOnAgent(repo: TestRepo, change: () => Promise<void>): Promise<void> {
  repo.git(['checkout', '--quiet', 'agent'])
  await change()
  repo.git(['add', '-A'])
  repo.git(['commit', '--quiet', '-m', 'agent work'])
  repo.git(['checkout', '--quiet', 'main'])
}

async function exists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false
  )
}

describe('worktreeDiffPatch committed work', () => {
  it('gives each changed file its own patch', async (context) => {
    const git = testGit.requireGit(context)
    const repo = await testGit.baseRepo(git)
    await commitOnAgent(repo, async () => {
      await repo.write({ path: 'keep.txt', content: 'one\nTWO\n' })
      await repo.write({ path: 'added.txt', content: 'x\n' })
    })

    const result = await worktreeDiffPatch(options(git, repo))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.uncommitted).toBe('no-worktree')
    expect(result.value.files.map((file) => file.path)).toEqual(['added.txt', 'keep.txt'])
    const keep = result.value.files[1]?.patch.toString()
    expect(keep).toContain('-two\n+TWO\n')
    expect(keep).not.toContain('added.txt')
  })

  it('leaves out what the base branch did after the agent diverged', async (context) => {
    const git = testGit.requireGit(context)
    const repo = await testGit.baseRepo(git)
    await commitOnAgent(repo, () => repo.write({ path: 'agent.txt', content: 'a\n' }))
    await repo.write({ path: 'main-only.txt', content: 'later\n' })
    repo.git(['add', '-A'])
    repo.git(['commit', '--quiet', '-m', 'main moves on'])

    const result = await worktreeDiffPatch(options(git, repo))

    expect(result.ok && result.value.files.map((file) => file.path)).toEqual(['agent.txt'])
  })

  it('reports a rename with both paths and its patch', async (context) => {
    const git = testGit.requireGit(context)
    const repo = await testGit.baseRepo(git)
    repo.git(['checkout', '--quiet', 'agent'])
    repo.git(['mv', 'old-name.txt', 'new-name.txt'])
    repo.git(['commit', '--quiet', '-m', 'rename'])

    const result = await worktreeDiffPatch(options(git, repo))

    expect(result.ok && result.value.files).toHaveLength(1)
    const [file] = result.ok ? result.value.files : []
    expect(file).toMatchObject({ path: 'new-name.txt', oldPath: 'old-name.txt' })
    expect(file?.patch.toString()).toContain('rename from old-name.txt\nrename to new-name.txt')
  })

  it('shows a file turned into a symlink once, with its deletion and its addition', async (context) => {
    const git = testGit.requireGit(context)
    const repo = await testGit.baseRepo(git)
    await commitOnAgent(repo, async () => {
      await rm(join(repo.dir, 'keep.txt'))
      await symlink('old-name.txt', join(repo.dir, 'keep.txt'))
    })

    const result = await worktreeDiffPatch(options(git, repo))

    expect(result.ok && result.value.files.map((file) => file.path)).toEqual(['keep.txt'])
    const patch = result.ok ? (result.value.files[0]?.patch.toString() ?? '') : ''
    expect(patch).toContain('deleted file mode 100644')
    expect(patch).toContain('new file mode 120000')
  })

  it('says a binary file differs, without its bytes', async (context) => {
    const git = testGit.requireGit(context)
    const repo = await testGit.baseRepo(git)
    await commitOnAgent(repo, () =>
      repo.write({ path: 'image.bin', content: Buffer.from([0, 1, 2, 0, 255]) })
    )

    const result = await worktreeDiffPatch(options(git, repo))

    const [file] = result.ok ? result.value.files : []
    expect(file?.path).toBe('image.bin')
    expect(file?.patch.toString()).toContain('Binary files /dev/null and b/image.bin differ')
  })

  it('splits files whose paths have spaces, quotes, tabs, newlines, and non-ASCII characters', async (context) => {
    const git = testGit.requireGit(context)
    const repo = await testGit.baseRepo(git)
    const paths = [
      'sp ace.txt',
      'é.txt',
      'qu"ote.txt',
      'tab\there.txt',
      'new\nline.txt',
      'b\\s.txt'
    ]
    await commitOnAgent(repo, async () => {
      for (const [i, path] of paths.entries()) await repo.write({ path, content: `body ${i}\n` })
    })

    const result = await worktreeDiffPatch(options(git, repo))

    const files = result.ok ? result.value.files : []
    expect(files.map((file) => file.path).sort()).toEqual([...paths].sort())
    for (const file of files) {
      const body = `+body ${paths.indexOf(file.path)}\n`
      expect(file.patch.toString()).toContain(body)
    }
  })

  it('lists the same files as the numstat of the same range', async (context) => {
    const git = testGit.requireGit(context)
    const repo = await testGit.baseRepo(git)
    await commitOnAgent(repo, async () => {
      await repo.write({ path: 'keep.txt', content: 'changed\n' })
      await repo.write({ path: 'dir/new file.txt', content: 'n\n' })
    })
    repo.git(['checkout', '--quiet', 'agent'])
    repo.git(['mv', 'old-name.txt', 'dir/renamed.txt'])
    repo.git(['commit', '--quiet', '-m', 'rename'])

    const [patch, stat] = await Promise.all([
      worktreeDiffPatch(options(git, repo)),
      worktreeDiffStat(options(git, repo))
    ])

    expect(patch.ok && patch.value.files.map((file) => file.path)).toEqual(
      stat.ok ? stat.value.files.map((file) => file.path) : undefined
    )
  })

  it('has no changes to show for an agent that did nothing', async (context) => {
    const git = testGit.requireGit(context)
    const repo = await testGit.baseRepo(git)

    expect(await worktreeDiffPatch(options(git, repo))).toEqual({
      ok: true,
      value: { uncommitted: 'no-worktree', files: [] }
    })
  })

  it('fails with branch-not-found for a deleted agent branch, like the numstat', async (context) => {
    const git = testGit.requireGit(context)
    const repo = await testGit.baseRepo(git)

    const result = await worktreeDiffPatch(options(git, repo, { agentBranch: 'gone' }))

    expect(result).toEqual({ ok: false, error: 'branch-not-found' })
  })

  it('fails with invalid-ref for a base that is not a commit', async (context) => {
    const git = testGit.requireGit(context)
    const repo = await testGit.baseRepo(git)

    const result = await worktreeDiffPatch(
      options(git, repo, { baseSha: 'not-a-sha' as WorktreeDiffStatOptions['baseSha'] })
    )

    expect(result).toEqual({ ok: false, error: 'invalid-ref' })
  })

  it('fails with invalid-path for a relative repository directory', async (context) => {
    const git = testGit.requireGit(context)
    const repo = await testGit.baseRepo(git)

    const result = await worktreeDiffPatch(options(git, repo, { repoDir: 'repo' }))

    expect(result).toEqual({ ok: false, error: 'invalid-path' })
  })
})

describe('worktreeDiffPatch uncommitted work', () => {
  function agentWorktree(repo: TestRepo): string {
    const worktree = join(repo.root, 'wt')
    repo.git(['worktree', 'add', '--quiet', worktree, 'agent'])
    return worktree
  }

  it('shows the working tree’s edits, staged or not, but not untracked files', async (context) => {
    const git = testGit.requireGit(context)
    const repo = await testGit.baseRepo(git)
    const worktree = agentWorktree(repo)
    await repo.write({ path: 'keep.txt', content: 'one\nthree\n', dir: worktree })
    await repo.write({ path: 'untracked.txt', content: 'u\n', dir: worktree })
    await repo.write({ path: 'image.bin', content: Buffer.from([0, 1, 2]), dir: worktree })
    repo.git(['add', 'image.bin'], worktree)

    const result = await worktreeDiffPatch(options(git, repo, { worktreeDir: worktree }))

    expect(result.ok && result.value.uncommitted).toBe('included')
    const files = result.ok ? result.value.files : []
    expect(files.map((file) => file.path)).toEqual(['image.bin', 'keep.txt'])
    expect(files[1]?.patch.toString()).toContain('-two\n+three\n')
  })

  it('lists the same files as the numstat of the working tree', async (context) => {
    const git = testGit.requireGit(context)
    const repo = await testGit.baseRepo(git)
    const worktree = agentWorktree(repo)
    await repo.write({ path: 'keep.txt', content: 'changed\n', dir: worktree })
    repo.git(['mv', 'old-name.txt', 'moved name.txt'], worktree)
    const input = options(git, repo, { worktreeDir: worktree })

    const [patch, stat] = await Promise.all([worktreeDiffPatch(input), worktreeDiffStat(input)])

    expect(patch.ok && patch.value.files.map((file) => file.path)).toEqual(
      stat.ok ? stat.value.files.map((file) => file.path) : undefined
    )
  })

  it('shows only committed work, like the numstat, when a changed path has a filter attribute', async (context) => {
    const git = testGit.requireGit(context)
    const repo = await testGit.baseRepo(git)
    await commitOnAgent(repo, () =>
      repo.write({ path: '.gitattributes', content: '*.dat filter=lfs\n' })
    )
    const worktree = agentWorktree(repo)
    await repo.write({ path: 'big.dat', content: 'pointer\n', dir: worktree })
    repo.git(['add', 'big.dat'], worktree)

    const result = await worktreeDiffPatch(options(git, repo, { worktreeDir: worktree }))

    expect(result.ok && result.value.uncommitted).toBe('skipped-filters')
    expect(result.ok && result.value.files.map((file) => file.path)).toEqual(['.gitattributes'])
  })

  it('diffs a directory that is not the agent’s worktree as committed work only', async (context) => {
    const git = testGit.requireGit(context)
    const repo = await testGit.baseRepo(git)
    await commitOnAgent(repo, () => repo.write({ path: 'agent.txt', content: 'a\n' }))

    const result = await worktreeDiffPatch(options(git, repo, { worktreeDir: repo.dir }))

    expect(result.ok && result.value.uncommitted).toBe('worktree-mismatch')
    expect(result.ok && result.value.files.map((file) => file.path)).toEqual(['agent.txt'])
  })
})

describe('worktreeDiffPatch against a hostile repository config', () => {
  it('ignores config that changes prefixes, color, context, and quoting', async (context) => {
    const git = testGit.requireGit(context)
    const repo = await testGit.baseRepo(git)
    const lines = Array.from({ length: 40 }, (_, i) => `line ${i}\n`).join('')
    await repo.write({ path: 'long.txt', content: lines })
    repo.git(['add', '-A'])
    repo.git(['commit', '--quiet', '-m', 'long'])
    repo.git(['branch', '-f', 'agent', 'main'])
    await commitOnAgent(repo, async () => {
      await repo.write({ path: 'long.txt', content: lines.replace('line 20\n', 'LINE 20\n') })
      await repo.write({ path: 'é.txt', content: 'x\n' })
    })
    for (const [key, value] of [
      ['diff.noprefix', 'true'],
      ['diff.mnemonicPrefix', 'true'],
      ['color.diff', 'always'],
      ['color.ui', 'always'],
      ['diff.context', '100'],
      ['core.quotePath', 'false'],
      ['diff.renames', 'false']
    ] as const) {
      repo.git(['config', key, value])
    }

    const result = await worktreeDiffPatch(options(git, repo))

    const files = result.ok ? result.value.files : []
    expect(files.map((file) => file.path)).toEqual(['long.txt', 'é.txt'])
    const text = files.map((file) => file.patch.toString()).join('')
    expect(text).not.toContain('\u001b')
    expect(text).toContain('diff --git a/long.txt b/long.txt')
    const body = files[0]?.patch.toString().split('\n') ?? []
    expect(body.filter((line) => line.startsWith(' '))).toHaveLength(6)
  })

  it('shows a changed submodule as its two recorded commits, whatever the config asks for', async (context) => {
    const git = testGit.requireGit(context)
    const repo = await testGit.baseRepo(git)
    const first = repo.sha('main')
    repo.git(['checkout', '--quiet', 'agent'])
    repo.git(['update-index', '--add', '--cacheinfo', `160000,${first},vendor/sub`])
    repo.git(['commit', '--quiet', '-m', 'add submodule'])
    repo.git(['checkout', '--quiet', 'main'])
    repo.git(['config', 'diff.submodule', 'log'])

    const result = await worktreeDiffPatch(options(git, repo))

    const [file] = result.ok ? result.value.files : []
    expect(file?.path).toBe('vendor/sub')
    expect(file?.patch.toString()).toContain(`+Subproject commit ${first}`)
  })

  it('runs no external diff program and no textconv', async (context) => {
    const git = testGit.requireGit(context)
    const repo = await testGit.baseRepo(git)
    const marker = join(repo.root, 'ran')
    const script = join(repo.root, 'evil.sh')
    await repo.write({ path: 'evil.sh', content: `#!/bin/sh\ntouch '${marker}'\n`, dir: repo.root })
    await chmod(script, 0o755)
    await commitOnAgent(repo, async () => {
      await repo.write({ path: '.gitattributes', content: '*.txt diff=evil\n' })
      await repo.write({ path: 'keep.txt', content: 'changed\n' })
    })
    repo.git(['config', 'diff.external', script])
    repo.git(['config', 'diff.evil.command', script])
    repo.git(['config', 'diff.evil.textconv', script])

    const result = await worktreeDiffPatch(options(git, repo))

    expect(result.ok).toBe(true)
    expect(await exists(marker)).toBe(false)
  })

  it('runs no filter driver on a worktree’s working tree', async (context) => {
    const git = testGit.requireGit(context)
    const repo = await testGit.baseRepo(git)
    const marker = join(repo.root, 'filter-ran')
    const script = join(repo.root, 'filter.sh')
    await repo.write({
      path: 'filter.sh',
      content: `#!/bin/sh\ntouch '${marker}'\ncat\n`,
      dir: repo.root
    })
    await chmod(script, 0o755)
    await commitOnAgent(repo, () =>
      repo.write({ path: '.gitattributes', content: '*.txt filter=evil\n' })
    )
    repo.git(['config', 'filter.evil.clean', script])
    const worktree = join(repo.root, 'wt')
    repo.git(['worktree', 'add', '--quiet', worktree, 'agent'])
    await repo.write({ path: 'keep.txt', content: 'edited\n', dir: worktree })

    const result = await worktreeDiffPatch(options(git, repo, { worktreeDir: worktree }))

    expect(result.ok && result.value.uncommitted).toBe('skipped-filters')
    expect(await exists(marker)).toBe(false)
  })
})

describe('worktreeDiffPatch git invocation', () => {
  it('runs one diff over the whole range with the fixed flags and no path', async (context) => {
    const real = testGit.requireGit(context)
    const repo = await testGit.baseRepo(real)
    await commitOnAgent(repo, () => repo.write({ path: 'keep.txt', content: 'x\n' }))
    const spy = spies.create(real)
    const input = options(spy.git, repo)

    await worktreeDiffPatch(input)

    const diffs = spy.events().filter((line) => line.includes(' diff '))
    // The numstat that decides the source, then the patch.
    expect(diffs).toHaveLength(2)
    const merge = repo.git(['merge-base', input.baseSha, repo.sha('agent')])
    const expected = ` diff ${PATCH_ARGS.join(' ')} ${merge} ${repo.sha('agent')} --`
    expect(diffs.at(-1)?.endsWith(expected)).toBe(true)
  })

  it('reads a worktree with diff-index, from the worktree, with the same flags', async (context) => {
    const real = testGit.requireGit(context)
    const repo = await testGit.baseRepo(real)
    const worktree = join(repo.root, 'wt')
    repo.git(['worktree', 'add', '--quiet', worktree, 'agent'])
    await repo.write({ path: 'keep.txt', content: 'x\n', dir: worktree })
    const spy = spies.create(real)

    await worktreeDiffPatch(options(spy.git, repo, { worktreeDir: worktree }))

    const line = spy.events().findLast((event) => event.includes(' diff-index '))
    expect(line).toContain(`-C ${worktree} diff-index ${PATCH_ARGS.join(' ')} `)
    expect(line?.endsWith(' --')).toBe(true)
  })

  it('fails with git-failed when the patch read exits non-zero', async (context) => {
    const real = testGit.requireGit(context)
    const repo = await testGit.baseRepo(real)
    await commitOnAgent(repo, () => repo.write({ path: 'keep.txt', content: 'x\n' }))
    const spy = spies.create(real, { exitOn: '--patch' })

    const result = await worktreeDiffPatch(options(spy.git, repo))

    expect(result).toEqual({ ok: false, error: 'git-failed' })
  })

  it('fails with output-too-large when the patch is bigger than the output cap', async (context) => {
    const git = testGit.requireGit(context)
    const repo = await testGit.baseRepo(git)
    await commitOnAgent(repo, () =>
      repo.write({ path: 'huge.txt', content: `${'x'.repeat(40)}\n`.repeat(600_000) })
    )

    const result = await worktreeDiffPatch(options(git, repo))

    expect(result).toEqual({ ok: false, error: 'output-too-large' })
  })
})
