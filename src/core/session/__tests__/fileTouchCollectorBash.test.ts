import { describe, expect, it } from 'vitest'
import { MAX_PATH_CODE_UNITS } from '../../shared/boundedPath'
import {
  buildAssistantToolUseRecord,
  buildBashToolUseResult,
  buildUserToolResultRecord
} from '../../transcript/testFileTouchFixtures'
import { MAX_BASH_CHANGED_FILES } from '../bashFileChanges'
import {
  createFileTouchCollector,
  MAX_BASH_TOUCHES_PER_TRANSCRIPT,
  type FileTouchCollector
} from '../fileTouchCollector'

/** Feeds a Bash call and its result to a fresh collector. */
function observeBash(toolUseResult: unknown, toolName = 'Bash'): FileTouchCollector {
  const collector = createFileTouchCollector()
  collector.observe(buildAssistantToolUseRecord({ toolUseId: 'toolu_bash', toolName }))
  collector.observe(buildUserToolResultRecord({ toolUseId: 'toolu_bash', toolUseResult }))
  return collector
}

const paths = (count: number): string[] =>
  Array.from({ length: count }, (_, n) => `/repo/file${n}.ts`)

describe('createFileTouchCollector Bash results', () => {
  it('lists a path with a flagless file entry as an update and one with no entry as a change, keeping no hunks', () => {
    const collector = observeBash(
      buildBashToolUseResult({
        changedFiles: ['/repo/a.ts', '/repo/b.ts'],
        files: [{ filePath: '/repo/a.ts', hunks: [{ lines: ['secret contents'] }] }]
      })
    )

    expect(collector.touches()).toEqual([
      { filePath: '/repo/a.ts', operation: 'update', source: 'bash', toolUseId: 'toolu_bash' },
      { filePath: '/repo/b.ts', operation: 'change', source: 'bash', toolUseId: 'toolu_bash' }
    ])
    expect(collector.incompleteToolUseIds()).toEqual([])
  })

  it('lists every changedFiles path when moreFiles truncated the hunks, and is not incomplete', () => {
    const named = paths(7)
    const collector = observeBash(
      buildBashToolUseResult({
        changedFiles: named,
        files: named.slice(0, 5).map((filePath) => ({ filePath, hunks: [] })),
        moreFiles: 2
      })
    )

    expect(collector.touches().map((touch) => touch.filePath)).toEqual(named)
    expect(collector.incompleteToolUseIds()).toEqual([])
  })

  it.each(['unavailable', 'shared', 'skipped'])(
    'marks a result flagged %s as incomplete, with no paths',
    (flag) => {
      const collector = observeBash(buildBashToolUseResult({ [flag]: true }))

      expect(collector.touches()).toEqual([])
      expect(collector.incompleteToolUseIds()).toEqual(['toolu_bash'])
    }
  )

  it('reads created and deleted file entries as create and delete', () => {
    const collector = observeBash(
      buildBashToolUseResult({
        changedFiles: ['/repo/new.ts', '/repo/gone.ts', '/repo/kept.ts'],
        files: [
          { filePath: '/repo/new.ts', created: true, hunks: [] },
          { filePath: '/repo/gone.ts', deleted: true, hunks: [] },
          { filePath: '/repo/kept.ts', hunks: [] }
        ]
      })
    )

    expect(collector.touches().map((touch) => touch.operation)).toEqual([
      'create',
      'delete',
      'update'
    ])
  })

  it('keeps the first MAX_BASH_CHANGED_FILES paths of a longer list and marks it incomplete', () => {
    const collector = observeBash(
      buildBashToolUseResult({ changedFiles: paths(MAX_BASH_CHANGED_FILES + 1) })
    )

    expect(collector.touches()).toHaveLength(MAX_BASH_CHANGED_FILES)
    expect(collector.incompleteToolUseIds()).toEqual(['toolu_bash'])
  })

  it('does not mark a list of exactly MAX_BASH_CHANGED_FILES paths incomplete', () => {
    const collector = observeBash(
      buildBashToolUseResult({ changedFiles: paths(MAX_BASH_CHANGED_FILES) })
    )

    expect(collector.touches()).toHaveLength(MAX_BASH_CHANGED_FILES)
    expect(collector.incompleteToolUseIds()).toEqual([])
  })

  it('drops a relative path, an over-long path, and a non-string entry, and marks the result incomplete', () => {
    const tooLong = `/${'a'.repeat(MAX_PATH_CODE_UNITS)}`
    const collector = observeBash(
      buildBashToolUseResult({ changedFiles: ['relative/a.ts', tooLong, 7, '/repo/ok.ts'] })
    )

    expect(collector.touches().map((touch) => touch.filePath)).toEqual(['/repo/ok.ts'])
    expect(collector.incompleteToolUseIds()).toEqual(['toolu_bash'])
  })

  it('adds nothing for a Bash result without a bashEditDiff', () => {
    const collector = observeBash(buildBashToolUseResult())

    expect(collector.touches()).toEqual([])
    expect(collector.incompleteToolUseIds()).toEqual([])
  })

  it('adds nothing for a Bash result whose bashEditDiff is null', () => {
    const collector = observeBash({ bashEditDiff: null })

    expect(collector.touches()).toEqual([])
    expect(collector.incompleteToolUseIds()).toEqual([])
  })

  it.each([
    ['a string', 'nope'],
    ['a number', 7],
    ['an array', []]
  ])(
    'adds nothing but marks the result incomplete when bashEditDiff is %s',
    (_name, bashEditDiff) => {
      const collector = observeBash({ bashEditDiff })

      expect(collector.touches()).toEqual([])
      expect(collector.incompleteToolUseIds()).toEqual(['toolu_bash'])
    }
  )

  it('lists a path repeated within one result once, and stays complete', () => {
    const collector = observeBash(
      buildBashToolUseResult({ changedFiles: ['/repo/a.ts', '/repo/b.ts', '/repo/a.ts'] })
    )

    expect(collector.touches().map((touch) => touch.filePath)).toEqual(['/repo/a.ts', '/repo/b.ts'])
    expect(collector.incompleteToolUseIds()).toEqual([])
  })

  it('lists one change and stays complete for a result of more than MAX_BASH_CHANGED_FILES copies of one path', () => {
    const collector = observeBash(
      buildBashToolUseResult({
        changedFiles: Array.from({ length: MAX_BASH_CHANGED_FILES + 44 }, () => '/repo/a.ts')
      })
    )

    expect(collector.touches().map((touch) => touch.filePath)).toEqual(['/repo/a.ts'])
    expect(collector.incompleteToolUseIds()).toEqual([])
  })

  it('stops walking changedFiles once MAX_BASH_CHANGED_FILES + 1 distinct paths are seen', () => {
    const repeats = Array.from({ length: 300 }, () => '/repo/a.ts')
    const distinct = paths(MAX_BASH_CHANGED_FILES)
    const walked = [...repeats, ...distinct]
    const stopIndex = walked.length
    const changedFiles = new Proxy([...walked, '/repo/never-read.ts'], {
      get(target, property, receiver) {
        if (typeof property === 'string' && Number(property) >= stopIndex) {
          throw new Error(`read past the stop point: ${property}`)
        }
        return Reflect.get(target, property, receiver)
      }
    })

    const collector = observeBash(buildBashToolUseResult({ changedFiles }))

    expect(collector.touches()).toHaveLength(MAX_BASH_CHANGED_FILES)
    expect(collector.incompleteToolUseIds()).toEqual(['toolu_bash'])
  })

  it('keeps a path repeated across different results, one touch per result', () => {
    const collector = createFileTouchCollector()
    for (const toolUseId of ['toolu_1', 'toolu_2']) {
      collector.observe(buildAssistantToolUseRecord({ toolUseId, toolName: 'Bash' }))
      collector.observe(
        buildUserToolResultRecord({
          toolUseId,
          toolUseResult: buildBashToolUseResult({ changedFiles: ['/repo/a.ts'] })
        })
      )
    }

    expect(collector.touches().map((touch) => touch.toolUseId)).toEqual(['toolu_1', 'toolu_2'])
  })

  it('adds nothing for a failed Bash call whose toolUseResult is a string', () => {
    expect(observeBash('Error: exit 1').touches()).toEqual([])
  })

  it('ignores a bashEditDiff on a tool that is not Bash', () => {
    const collector = observeBash(buildBashToolUseResult({ changedFiles: ['/repo/a.ts'] }), 'Edit')

    expect(collector.touches()).toEqual([])
  })

  it.each([
    ['is missing', undefined],
    ['is not an array', '/repo/a.ts']
  ])('falls back to the file entries and is incomplete when changedFiles %s', (_name, named) => {
    const collector = observeBash(
      buildBashToolUseResult({
        ...(named !== undefined && { changedFiles: named }),
        files: [{ filePath: '/repo/a.ts', created: true }]
      })
    )

    expect(collector.touches().map((touch) => [touch.filePath, touch.operation])).toEqual([
      ['/repo/a.ts', 'create']
    ])
    expect(collector.incompleteToolUseIds()).toEqual(['toolu_bash'])
  })

  it.each([
    ['is not an array and files is unusable', { changedFiles: 7, files: 'nope' }],
    ['is missing and files is missing', {}],
    ['is empty', { changedFiles: [] }]
  ])('adds nothing but marks the result incomplete when changedFiles %s', (_name, diff) => {
    const collector = observeBash(buildBashToolUseResult(diff))

    expect(collector.touches()).toEqual([])
    expect(collector.incompleteToolUseIds()).toEqual(['toolu_bash'])
  })

  it('skips a malformed file entry: not an object, or a non-string filePath', () => {
    const collector = observeBash(
      buildBashToolUseResult({
        changedFiles: ['/repo/a.ts'],
        files: [
          '/repo/a.ts',
          7,
          null,
          { filePath: 7, created: true },
          { filePath: '/repo/a.ts', deleted: true }
        ]
      })
    )

    expect(collector.touches().map((touch) => touch.operation)).toEqual(['delete'])
  })

  it('reads a non-boolean created or deleted as absent', () => {
    const collector = observeBash(
      buildBashToolUseResult({
        changedFiles: ['/repo/a.ts', '/repo/b.ts'],
        files: [
          { filePath: '/repo/a.ts', created: 'yes' },
          { filePath: '/repo/b.ts', deleted: 1 }
        ]
      })
    )

    expect(collector.touches().map((touch) => touch.operation)).toEqual(['update', 'update'])
  })

  it('reads a non-boolean unavailable flag as absent, keeping the rest of the diff', () => {
    const collector = observeBash(
      buildBashToolUseResult({ changedFiles: ['/repo/a.ts'], unavailable: 'yes' })
    )

    expect(collector.touches().map((touch) => touch.filePath)).toEqual(['/repo/a.ts'])
    expect(collector.incompleteToolUseIds()).toEqual([])
  })

  describe('incomplete result cap', () => {
    /** Feeds `count` Bash results that each report they could not tell what changed. */
    function observeUnavailableResults(count: number): FileTouchCollector {
      const collector = createFileTouchCollector()
      for (let index = 0; index < count; index += 1) {
        const toolUseId = `toolu_${index}`
        collector.observe(buildAssistantToolUseRecord({ toolUseId, toolName: 'Bash' }))
        collector.observe(
          buildUserToolResultRecord({
            toolUseId,
            toolUseResult: buildBashToolUseResult({ unavailable: true })
          })
        )
      }
      return collector
    }

    it('remembers every incomplete result up to the cap without overflowing', () => {
      const collector = observeUnavailableResults(MAX_BASH_TOUCHES_PER_TRANSCRIPT)

      expect(collector.incompleteToolUseIds()).toHaveLength(MAX_BASH_TOUCHES_PER_TRANSCRIPT)
      expect(collector.incompleteOverflowed()).toBe(false)
    })

    it('remembers at most the cap, and reports the overflow once one more arrives', () => {
      const collector = observeUnavailableResults(MAX_BASH_TOUCHES_PER_TRANSCRIPT + 1)

      expect(collector.incompleteToolUseIds()).toHaveLength(MAX_BASH_TOUCHES_PER_TRANSCRIPT)
      expect(collector.incompleteOverflowed()).toBe(true)
    })
  })

  describe('total cap', () => {
    /** Feeds `count` Bash results of 256 paths each, with ids `toolu_0`, `toolu_1`, and so on. */
    function observeManyResults(count: number): FileTouchCollector {
      const collector = createFileTouchCollector()
      for (let index = 0; index < count; index += 1) {
        const toolUseId = `toolu_${index}`
        collector.observe(buildAssistantToolUseRecord({ toolUseId, toolName: 'Bash' }))
        collector.observe(
          buildUserToolResultRecord({
            toolUseId,
            toolUseResult: buildBashToolUseResult({
              changedFiles: paths(MAX_BASH_CHANGED_FILES).map((path) => `${path}.${index}`)
            })
          })
        )
      }
      return collector
    }

    const RESULTS_AT_CAP = MAX_BASH_TOUCHES_PER_TRANSCRIPT / MAX_BASH_CHANGED_FILES

    it('keeps every touch and stays complete when the transcript ends exactly at the cap', () => {
      const collector = observeManyResults(RESULTS_AT_CAP)

      expect(collector.touches()).toHaveLength(MAX_BASH_TOUCHES_PER_TRANSCRIPT)
      expect(collector.incompleteToolUseIds()).toEqual([])
    })

    it('stops adding Bash touches past the cap and marks the results that lost some incomplete', () => {
      const collector = observeManyResults(RESULTS_AT_CAP + 2)

      expect(collector.touches()).toHaveLength(MAX_BASH_TOUCHES_PER_TRANSCRIPT)
      expect(collector.incompleteToolUseIds()).toEqual([
        `toolu_${RESULTS_AT_CAP}`,
        `toolu_${RESULTS_AT_CAP + 1}`
      ])
    })
  })
})
