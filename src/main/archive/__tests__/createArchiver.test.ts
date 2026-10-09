import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionRefDto } from '../../../shared/ipc/sessionRefDto'
import {
  ARCHIVE_DETAIL_AFTER_DAYS,
  ARCHIVE_PASS_DELAY_MS,
  ARCHIVE_PASS_INTERVAL_MS,
  DAY_MS
} from '../archiveConstants'
import { createArchiver, type ArchivableProject, type ArchiverOptions } from '../createArchiver'
import type { PendingDetail } from '../archiveStoreTypes'
import { errorWithCode } from '../../testErrorWithCode'

const NOW = 1_000 * DAY_MS
const OLD = NOW - (ARCHIVE_DETAIL_AFTER_DAYS + 1) * DAY_MS
const RECENT = NOW - DAY_MS

function ref(projectDirName: string, sessionId: string): SessionRefDto {
  return { projectDirName, sessionId }
}

function pending(projectDirName: string, sessionId: string, lastMs: number): PendingDetail {
  return {
    ref: ref(projectDirName, sessionId),
    source: { mtimeMs: lastMs, size: 1 },
    activityLatestMs: lastMs
  }
}

/** A project that has every session and records the details archived for it. */
function projectOf(
  dirName: string,
  calls: string[],
  overrides: Partial<ArchivableProject> = {}
): ArchivableProject {
  return {
    has: () => true,
    archiveDetail: (sessionId) => {
      calls.push(`detail:${dirName}/${sessionId}`)
      return Promise.resolve()
    },
    ...overrides
  }
}

/** Fake dependencies that record what the archiver asks for. */
function setup(overrides: Partial<ArchiverOptions> = {}): {
  options: ArchiverOptions
  calls: string[]
  logs: string[]
} {
  const calls: string[] = []
  const logs: string[] = []
  const options: ArchiverOptions = {
    listProjects: () => {
      calls.push('projects')
      return Promise.resolve(['a', 'b'])
    },
    changedSessions: (dir) => {
      calls.push(`changed:${dir}`)
      return Promise.resolve(true)
    },
    listSessions: (dir) => {
      calls.push(`list:${dir}`)
      return Promise.resolve()
    },
    pendingDetails: () => [],
    openProject: (dir) => {
      calls.push(`open:${dir}`)
      return Promise.resolve(projectOf(dir, calls))
    },
    skipDetail: (target) => {
      calls.push(`skip:${target.projectDirName}/${target.sessionId}`)
    },
    now: () => NOW,
    log: (line) => logs.push(line),
    ...overrides
  }
  return { options, calls, logs }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('createArchiver schedule', () => {
  it('runs nothing before the first delay', async () => {
    const { options, calls } = setup()
    createArchiver(options).start()

    await vi.advanceTimersByTimeAsync(ARCHIVE_PASS_DELAY_MS - 1)

    expect(calls).toEqual([])
  })

  it('runs the first pass once the delay passes', async () => {
    const { options, calls } = setup()
    createArchiver(options).start()

    await vi.advanceTimersByTimeAsync(ARCHIVE_PASS_DELAY_MS)

    expect(calls).toContain('projects')
  })

  it('waits the interval after a pass before the next one', async () => {
    const { options, calls } = setup()
    createArchiver(options).start()
    await vi.advanceTimersByTimeAsync(ARCHIVE_PASS_DELAY_MS)
    const afterFirst = calls.filter((call) => call === 'projects').length

    await vi.advanceTimersByTimeAsync(ARCHIVE_PASS_INTERVAL_MS - 1)
    const beforeSecond = calls.filter((call) => call === 'projects').length
    await vi.advanceTimersByTimeAsync(1)
    const afterSecond = calls.filter((call) => call === 'projects').length

    expect([afterFirst, beforeSecond, afterSecond]).toEqual([1, 1, 2])
  })

  it('runs nothing after stop, even from a pending timer', async () => {
    const { options, calls } = setup()
    const archiver = createArchiver(options)
    archiver.start()

    archiver.stop()
    await vi.advanceTimersByTimeAsync(ARCHIVE_PASS_DELAY_MS * 2)

    expect(calls).toEqual([])
  })

  it('schedules no further pass after stop during a pass', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const { options, calls } = setup({
      listProjects: async () => {
        calls.push('projects')
        await gate
        return ['a']
      }
    })
    const archiver = createArchiver(options)
    archiver.start()
    await vi.advanceTimersByTimeAsync(ARCHIVE_PASS_DELAY_MS)

    archiver.stop()
    release()
    await vi.advanceTimersByTimeAsync(ARCHIVE_PASS_INTERVAL_MS * 2)

    expect(calls.filter((call) => call === 'projects')).toHaveLength(1)
  })

  it('does not start a second schedule when started twice', async () => {
    const { options, calls } = setup()
    const archiver = createArchiver(options)
    archiver.start()
    archiver.start()

    await vi.advanceTimersByTimeAsync(ARCHIVE_PASS_DELAY_MS)

    expect(calls.filter((call) => call === 'projects')).toHaveLength(1)
  })
})

describe('createArchiver pass', () => {
  it('lists only the projects whose sessions changed', async () => {
    const { options, calls } = setup({
      changedSessions: (dir) => Promise.resolve(dir === 'b')
    })

    await createArchiver(options).runPass()

    expect(calls).toEqual(['projects', 'list:b'])
  })

  it('checks the projects one at a time in listed order', async () => {
    const order: string[] = []
    const { options } = setup({
      changedSessions: async (dir) => {
        order.push(`start:${dir}`)
        await Promise.resolve()
        order.push(`end:${dir}`)
        return false
      }
    })

    await createArchiver(options).runPass()

    expect(order).toEqual(['start:a', 'end:a', 'start:b', 'end:b'])
  })

  it('archives details only for sessions quiet for the whole waiting period', async () => {
    const { options, calls } = setup({
      changedSessions: () => Promise.resolve(false),
      pendingDetails: () => [pending('a', 'old', OLD), pending('a', 'recent', RECENT)]
    })

    await createArchiver(options).runPass()

    expect(calls).toEqual(['projects', 'open:a', 'detail:a/old'])
  })

  it('judges a session by its transcript time when it has no message time', async () => {
    const { options, calls } = setup({
      changedSessions: () => Promise.resolve(false),
      pendingDetails: () => [{ ...pending('a', 'quiet', OLD), activityLatestMs: null }]
    })

    await createArchiver(options).runPass()

    expect(calls).toContain('detail:a/quiet')
  })

  it('skips a pending session whose project is not listed', async () => {
    const { options, calls } = setup({
      changedSessions: () => Promise.resolve(false),
      pendingDetails: () => [pending('gone', 'old', OLD)]
    })

    await createArchiver(options).runPass()

    expect(calls).toEqual(['projects'])
  })

  it('reads the pending sessions only after the changed projects are listed', async () => {
    const order: string[] = []
    const { options } = setup({
      changedSessions: () => Promise.resolve(true),
      listSessions: (dir) => {
        order.push(`list:${dir}`)
        return Promise.resolve()
      },
      pendingDetails: () => {
        order.push('pending')
        return []
      }
    })

    await createArchiver(options).runPass()

    expect(order).toEqual(['list:a', 'list:b', 'pending'])
  })

  it('stops archiving details once stopped mid-pass', async () => {
    const archiverRef: { current?: ReturnType<typeof createArchiver> } = {}
    const { options, calls } = setup({
      changedSessions: () => Promise.resolve(false),
      pendingDetails: () => [
        pending('a', 's1', OLD),
        pending('a', 's2', OLD),
        pending('b', 's3', OLD)
      ],
      openProject: (dir) => {
        calls.push(`open:${dir}`)
        return Promise.resolve(
          projectOf(dir, calls, {
            archiveDetail: (sessionId) => {
              calls.push(`detail:${sessionId}`)
              archiverRef.current?.stop()
              return Promise.resolve()
            }
          })
        )
      }
    })
    archiverRef.current = createArchiver(options)

    await archiverRef.current.runPass()

    expect(calls.filter((call) => call.startsWith('detail:'))).toEqual(['detail:s1'])
    expect(calls).not.toContain('open:b')
  })

  it('opens each project once for all its due sessions, in listed order', async () => {
    const { options, calls } = setup({
      changedSessions: () => Promise.resolve(false),
      pendingDetails: () => [
        pending('b', 's3', OLD),
        pending('a', 's1', OLD),
        pending('a', 's2', OLD)
      ]
    })

    await createArchiver(options).runPass()

    expect(calls).toEqual([
      'projects',
      'open:a',
      'detail:a/s1',
      'detail:a/s2',
      'open:b',
      'detail:b/s3'
    ])
  })

  it('opens no project that has nothing due', async () => {
    const { options, calls } = setup({
      changedSessions: () => Promise.resolve(false),
      pendingDetails: () => [pending('a', 'recent', RECENT)]
    })

    await createArchiver(options).runPass()

    expect(calls).toEqual(['projects'])
  })

  it('skips a pending session its project no longer has, without scanning it', async () => {
    const { options, calls } = setup({
      changedSessions: () => Promise.resolve(false),
      pendingDetails: () => [pending('a', 'gone', OLD), pending('a', 'here', OLD)],
      openProject: (dir) => {
        calls.push(`open:${dir}`)
        return Promise.resolve(projectOf(dir, calls, { has: (sessionId) => sessionId !== 'gone' }))
      }
    })

    await createArchiver(options).runPass()

    expect(calls).toEqual(['projects', 'open:a', 'skip:a/gone', 'detail:a/here'])
  })

  it('does nothing for a project that cannot be opened because it is gone', async () => {
    const { options, calls, logs } = setup({
      changedSessions: () => Promise.resolve(false),
      pendingDetails: () => [pending('a', 's1', OLD)],
      openProject: (dir) => {
        calls.push(`open:${dir}`)
        return Promise.resolve(undefined)
      }
    })

    await createArchiver(options).runPass()

    expect(calls).toEqual(['projects', 'open:a'])
    expect(logs).toEqual([])
  })

  it('continues with the next project after opening one fails, logging only its code', async () => {
    const { options, calls, logs } = setup({
      changedSessions: () => Promise.resolve(false),
      pendingDetails: () => [pending('a', 's1', OLD), pending('b', 's2', OLD)],
      openProject: (dir) => {
        calls.push(`open:${dir}`)
        return dir === 'a'
          ? Promise.reject(errorWithCode('EPASS_OPEN'))
          : Promise.resolve(projectOf(dir, calls))
      }
    })

    await createArchiver(options).runPass()

    expect(calls).toContain('detail:b/s2')
    expect(logs).toEqual(['Beekeeper archive pass skipped a project (EPASS_OPEN).'])
  })

  it('stops checking projects once stopped mid-pass', async () => {
    const archiverRef: { current?: ReturnType<typeof createArchiver> } = {}
    const { options, calls } = setup({
      changedSessions: (dir) => {
        calls.push(`changed:${dir}`)
        archiverRef.current?.stop()
        return Promise.resolve(false)
      }
    })
    archiverRef.current = createArchiver(options)

    await archiverRef.current.runPass()

    expect(calls).toEqual(['projects', 'changed:a'])
  })

  it('continues with the next project after one fails, logging only its code', async () => {
    const { options, calls, logs } = setup({
      changedSessions: (dir) =>
        dir === 'a' ? Promise.reject(errorWithCode('EPASS_PROJECT')) : Promise.resolve(true)
    })

    await createArchiver(options).runPass()

    expect(calls).toContain('list:b')
    expect(logs).toEqual(['Beekeeper archive pass skipped a project (EPASS_PROJECT).'])
  })

  it('continues with the next detail after one fails, logging only its code', async () => {
    const { options, calls, logs } = setup({
      changedSessions: () => Promise.resolve(false),
      pendingDetails: () => [pending('a', 's1', OLD), pending('a', 's2', OLD)],
      openProject: (dir) =>
        Promise.resolve(
          projectOf(dir, calls, {
            archiveDetail: (sessionId) =>
              sessionId === 's1'
                ? Promise.reject(errorWithCode('EPASS_DETAIL'))
                : (calls.push('detail:s2'), Promise.resolve())
          })
        )
    })

    await createArchiver(options).runPass()

    expect(calls).toContain('detail:s2')
    expect(logs).toEqual(['Beekeeper archive pass skipped a session detail (EPASS_DETAIL).'])
  })

  it('logs a failure to list the projects and ends the pass', async () => {
    const { options, calls, logs } = setup({
      listProjects: () => Promise.reject(errorWithCode('EPASS_ROOT'))
    })

    await createArchiver(options).runPass()

    expect(calls).toEqual([])
    expect(logs).toEqual(['Beekeeper archive pass failed to list projects (EPASS_ROOT).'])
  })

  it('resolves and logs the code when reading the pending sessions throws', async () => {
    const { options, logs } = setup({
      changedSessions: () => Promise.resolve(false),
      pendingDetails: () => {
        throw errorWithCode('EPASS_PENDING')
      }
    })

    await expect(createArchiver(options).runPass()).resolves.toBeUndefined()

    expect(logs).toEqual(['Beekeeper archive pass failed (EPASS_PENDING).'])
  })

  it('still schedules the next pass after a failed pass', async () => {
    let attempts = 0
    const { options } = setup({
      listProjects: () => {
        attempts += 1
        return Promise.reject(errorWithCode('EPASS_AGAIN'))
      }
    })
    createArchiver(options).start()

    await vi.advanceTimersByTimeAsync(ARCHIVE_PASS_DELAY_MS + ARCHIVE_PASS_INTERVAL_MS)

    expect(attempts).toBe(2)
  })

  it('never overlaps passes: a pass requested during a pass joins it', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let listings = 0
    const { options } = setup({
      listProjects: async () => {
        listings += 1
        await gate
        return []
      }
    })
    const archiver = createArchiver(options)

    const first = archiver.runPass()
    const second = archiver.runPass()
    release()
    await Promise.all([first, second])

    expect(listings).toBe(1)
  })
})
