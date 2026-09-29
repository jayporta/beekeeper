import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_PATH_CODE_UNITS } from '../../shared/boundedPath'
import { hangingFsRunner, neverSettles } from '../testFsRunner'
import type { FsRunner } from '../fsDeadline'
import { MAX_WALK_MS, resolveInside } from '../resolveInside'

let parent: string
let root: string

beforeEach(async () => {
  // macOS keeps temp dirs under /var, a link to /private/var, and the root has to be real.
  parent = await realpath(await mkdtemp(join(tmpdir(), 'beekeeper-inside-')))
  root = join(parent, 'root')
  await mkdir(join(root, 'dir', 'sub'), { recursive: true })
  await writeFile(join(root, 'file.txt'), 'x')
})

afterEach(async () => {
  await rm(parent, { recursive: true, force: true })
})

describe('resolveInside', () => {
  it('returns a plain path unchanged', async () => {
    const path = join(root, 'dir', 'sub')

    expect(await resolveInside({ root, path })).toEqual({ ok: true, value: path })
  })

  it('returns the root itself for the root', async () => {
    expect(await resolveInside({ root, path: root })).toEqual({ ok: true, value: root })
  })

  it('follows a link that stays inside the root', async () => {
    await symlink('dir', join(root, 'inside'))

    const result = await resolveInside({ root, path: join(root, 'inside', 'sub') })

    expect(result).toEqual({ ok: true, value: join(root, 'dir', 'sub') })
  })

  it('follows a link that is the last component of the path', async () => {
    await symlink('dir', join(root, 'inside'))

    const result = await resolveInside({ root, path: join(root, 'inside') })

    expect(result).toEqual({ ok: true, value: join(root, 'dir') })
  })

  it('follows a link to a link inside the root', async () => {
    await symlink('dir', join(root, 'first'))
    await symlink('first', join(root, 'second'))

    const result = await resolveInside({ root, path: join(root, 'second', 'sub') })

    expect(result).toEqual({ ok: true, value: join(root, 'dir', 'sub') })
  })

  it('follows a link whose absolute target is inside the root', async () => {
    await symlink(join(root, 'dir'), join(root, 'absolute'))

    const result = await resolveInside({ root, path: join(root, 'absolute', 'sub') })

    expect(result).toEqual({ ok: true, value: join(root, 'dir', 'sub') })
  })

  it('follows a relative link whose ../ target stays inside the root', async () => {
    await symlink(join('..', '..', 'dir'), join(root, 'dir', 'sub', 'up'))

    const result = await resolveInside({ root, path: join(root, 'dir', 'sub', 'up', 'sub') })

    expect(result).toEqual({ ok: true, value: join(root, 'dir', 'sub') })
  })

  it('refuses a link with an absolute target outside the root before touching it', async () => {
    // Nothing exists there: following the link would report not-found instead.
    await symlink(join(parent, 'never-created'), join(root, 'escape'))

    const result = await resolveInside({ root, path: join(root, 'escape', 'x') })

    expect(result).toEqual({ ok: false, error: 'escapes-root' })
  })

  it('refuses a link whose relative ../ target leaves the root before touching it', async () => {
    await symlink(relative(root, join(parent, 'never-created')), join(root, 'escape'))

    const result = await resolveInside({ root, path: join(root, 'escape', 'x') })

    expect(result).toEqual({ ok: false, error: 'escapes-root' })
  })

  it('refuses a link whose absolute target has a .. component', async () => {
    await symlink(`${root}/dir/../file.txt`, join(root, 'sneaky'))

    const result = await resolveInside({ root, path: join(root, 'sneaky') })

    expect(result).toEqual({ ok: false, error: 'escapes-root' })
  })

  it('refuses a path that does not start with the root', async () => {
    expect(await resolveInside({ root, path: join(parent, 'elsewhere') })).toEqual({
      ok: false,
      error: 'escapes-root'
    })
  })

  it.each([
    ['a .. component', (base: string) => `${base}/dir/../file.txt`],
    ['a . component', (base: string) => `${base}/dir/./sub`]
  ])('refuses a path with %s', async (_label, build) => {
    expect(await resolveInside({ root, path: build(root) })).toEqual({
      ok: false,
      error: 'dotdot'
    })
  })

  it('stops a link cycle at the hop bound', async () => {
    await symlink('b', join(root, 'a'))
    await symlink('a', join(root, 'b'))

    expect(await resolveInside({ root, path: join(root, 'a') })).toEqual({
      ok: false,
      error: 'too-many-links'
    })
  })

  it('refuses a chain of links whose targets keep stepping through ..', async () => {
    // Each target is short enough for any filesystem, uses few hops, and adds
    // 200 steps; together the chain passes the step cap while ending at a real file.
    const detour = 'dir/../'.repeat(100)
    const links = 8
    for (let index = 0; index < links; index += 1) {
      const last = index === links - 1
      await symlink(`${detour}${last ? 'file.txt' : `l${index + 1}`}`, join(root, `l${index}`))
    }

    expect(await resolveInside({ root, path: join(root, 'l0') })).toEqual({
      ok: false,
      error: 'too-many-steps'
    })
  })

  it('refuses a path over the path cap before walking it', async () => {
    const path = `${root}/${'a/'.repeat(MAX_PATH_CODE_UNITS)}`

    // Walking it would report not-found at the first missing component.
    expect(await resolveInside({ root, path })).toEqual({ ok: false, error: 'too-long' })
  })

  it('reports a missing component as not-found', async () => {
    expect(await resolveInside({ root, path: join(root, 'dir', 'missing', 'x') })).toEqual({
      ok: false,
      error: 'not-found'
    })
  })

  it('refuses a plain path that goes through a file as not-a-directory', async () => {
    expect(await resolveInside({ root, path: join(root, 'file.txt', 'x') })).toEqual({
      ok: false,
      error: 'not-a-directory'
    })
  })

  it('refuses a link whose target goes through a file and climbs back out with ..', async () => {
    // The kernel fails file.txt/.. with ENOTDIR; climbing out of the file would land in dir.
    await symlink('file.txt/../dir', join(root, 'sneaky'))

    expect(await resolveInside({ root, path: join(root, 'sneaky') })).toEqual({
      ok: false,
      error: 'not-a-directory'
    })
  })

  it('returns a file that is the last component of the path', async () => {
    const path = join(root, 'file.txt')

    expect(await resolveInside({ root, path })).toEqual({ ok: true, value: path })
  })

  describe('when a filesystem call hangs', () => {
    it('reports timeout when reading a component hangs', async () => {
      const path = join(root, 'dir', 'sub')

      expect(
        await resolveInside({ root, path, fsRunner: hangingFsRunner({ passes: 0, hangs: 1 }) })
      ).toEqual({
        ok: false,
        error: 'timeout'
      })
    })

    it('reports timeout when reading a link target hangs', async () => {
      // A link to the root leaves no component to walk, so no later call can hang in its place.
      await symlink(root, join(root, 'loop'))
      const path = join(root, 'loop')

      expect(
        await resolveInside({ root, path, fsRunner: hangingFsRunner({ passes: 1, hangs: 1 }) })
      ).toEqual({
        ok: false,
        error: 'timeout'
      })
    })
  })

  describe('when every call answers slowly', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it('reports timeout once the whole walk passes its deadline', async () => {
      const path = join(root, 'a', 'b', 'c', 'd', 'e')
      await mkdir(path, { recursive: true })
      vi.useFakeTimers()
      // Each call takes 4.9 s, just inside a 5 s per-call deadline.
      const slow: FsRunner = async (call) => {
        await vi.advanceTimersByTimeAsync(4900)
        return call()
      }

      expect(await resolveInside({ root, path, fsRunner: slow })).toEqual({
        ok: false,
        error: 'timeout'
      })
    })

    it('starts no further call once the budget ran out between two calls', async () => {
      vi.useFakeTimers()
      let started = 0
      const spendBudgetAfterFirst: FsRunner = async (call) => {
        started += 1
        const value = await call()
        // Moves the clock without firing any timer, so only the budget check can notice.
        vi.setSystemTime(Date.now() + MAX_WALK_MS)
        return value
      }

      const result = await resolveInside({
        root,
        path: join(root, 'dir', 'sub'),
        fsRunner: spendBudgetAfterFirst
      })

      expect(result).toEqual({ ok: false, error: 'timeout' })
      expect(started).toBe(1)
    })

    it('reports timeout when a call outlasts the walk budget, with no per-call deadline to end it', async () => {
      vi.useFakeTimers()
      const hung: FsRunner = () => neverSettles()
      const walk = resolveInside({ root, path: join(root, 'dir'), fsRunner: hung })

      await vi.advanceTimersByTimeAsync(MAX_WALK_MS)

      expect(await walk).toEqual({ ok: false, error: 'timeout' })
    })

    it('does not cut a call short before the walk budget is spent', async () => {
      vi.useFakeTimers()
      const hung: FsRunner = () => neverSettles()
      const watched = { done: false }
      void resolveInside({ root, path: join(root, 'dir'), fsRunner: hung }).then(() => {
        watched.done = true
      })

      await vi.advanceTimersByTimeAsync(MAX_WALK_MS - 1)

      expect(watched.done).toBe(false)
    })

    it('leaves no timer running once the walk finishes', async () => {
      vi.useFakeTimers()

      await resolveInside({ root, path: join(root, 'dir', 'sub') })

      expect(vi.getTimerCount()).toBe(0)
    })
  })
})
