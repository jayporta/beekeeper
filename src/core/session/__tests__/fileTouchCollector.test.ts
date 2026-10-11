import { describe, expect, it } from 'vitest'
import {
  buildAssistantToolUseRecord,
  buildBashToolUseResult,
  buildEditToolUseResult,
  buildToolResultBlock,
  buildUserToolResultRecord,
  buildWriteToolUseResult
} from '../../transcript/testFileTouchFixtures'
import { createFileTouchCollector, FILE_TOUCH_ENTRY_OVERHEAD } from '../fileTouchCollector'

describe('createFileTouchCollector', () => {
  it('reports no touches when nothing was observed', () => {
    expect(createFileTouchCollector().touches()).toEqual([])
  })

  it('pairs an Edit tool_use with its tool_result into an edit touch', () => {
    const collector = createFileTouchCollector()

    collector.observe(buildAssistantToolUseRecord({ toolUseId: 'toolu_1', toolName: 'Edit' }))
    collector.observe(
      buildUserToolResultRecord({
        toolUseId: 'toolu_1',
        toolUseResult: buildEditToolUseResult('/a.ts')
      })
    )

    expect(collector.touches()).toEqual([
      { filePath: '/a.ts', operation: 'edit', source: 'edit-write', toolUseId: 'toolu_1' }
    ])
  })

  it('reports a Write create result with the operation from its type', () => {
    const collector = createFileTouchCollector()

    collector.observe(buildAssistantToolUseRecord({ toolUseId: 'toolu_2', toolName: 'Write' }))
    collector.observe(
      buildUserToolResultRecord({
        toolUseId: 'toolu_2',
        toolUseResult: buildWriteToolUseResult('/new.ts', 'create')
      })
    )

    expect(collector.touches()).toEqual([
      { filePath: '/new.ts', operation: 'create', source: 'edit-write', toolUseId: 'toolu_2' }
    ])
  })

  it('reports a Write update result with the operation from its type', () => {
    const collector = createFileTouchCollector()

    collector.observe(buildAssistantToolUseRecord({ toolUseId: 'toolu_3', toolName: 'Write' }))
    collector.observe(
      buildUserToolResultRecord({
        toolUseId: 'toolu_3',
        toolUseResult: buildWriteToolUseResult('/existing.ts', 'update')
      })
    )

    expect(collector.touches()).toEqual([
      { filePath: '/existing.ts', operation: 'update', source: 'edit-write', toolUseId: 'toolu_3' }
    ])
  })

  it.each([
    ['Edit', buildEditToolUseResult('/a.ts')],
    ['Bash', buildBashToolUseResult({ changedFiles: ['/a.ts'] })]
  ])('counts a second %s result carrying the same tool_use_id only once', (toolName, result) => {
    const collector = createFileTouchCollector()

    collector.observe(buildAssistantToolUseRecord({ toolUseId: 'toolu_4', toolName }))
    collector.observe(buildUserToolResultRecord({ toolUseId: 'toolu_4', toolUseResult: result }))
    collector.observe(buildUserToolResultRecord({ toolUseId: 'toolu_4', toolUseResult: result }))

    expect(collector.touches()).toHaveLength(1)
  })

  it.each(['Read', 'Grep'])(
    'ignores a %s result even when its toolUseResult has the shape of a Write',
    (toolName) => {
      const collector = createFileTouchCollector()

      collector.observe(buildAssistantToolUseRecord({ toolUseId: 'toolu_untracked', toolName }))
      collector.observe(
        buildUserToolResultRecord({
          toolUseId: 'toolu_untracked',
          toolUseResult: buildWriteToolUseResult('/a.ts', 'create')
        })
      )

      expect(collector.touches()).toEqual([])
    }
  )

  it('ignores a tool_result with no earlier tool_use', () => {
    const collector = createFileTouchCollector()

    collector.observe(
      buildUserToolResultRecord({
        toolUseId: 'toolu_unknown',
        toolUseResult: buildEditToolUseResult('/a.ts')
      })
    )

    expect(collector.touches()).toEqual([])
  })

  it('ignores a user record holding more than one tool_result block', () => {
    const collector = createFileTouchCollector()

    collector.observe(buildAssistantToolUseRecord({ toolUseId: 'toolu_5', toolName: 'Edit' }))
    collector.observe(
      buildUserToolResultRecord({
        contentBlocks: [
          buildToolResultBlock({ tool_use_id: 'toolu_5' }),
          buildToolResultBlock({ tool_use_id: 'toolu_5' })
        ],
        toolUseResult: buildEditToolUseResult('/a.ts')
      })
    )

    expect(collector.touches()).toEqual([])
  })

  it('does not count a string toolUseResult, a failed call', () => {
    const collector = createFileTouchCollector()

    collector.observe(buildAssistantToolUseRecord({ toolUseId: 'toolu_6', toolName: 'Edit' }))
    collector.observe(
      buildUserToolResultRecord({ toolUseId: 'toolu_6', toolUseResult: 'Error: EACCES' })
    )

    expect(collector.touches()).toEqual([])
  })

  it('does not count a tool_result with no toolUseResult at all', () => {
    const collector = createFileTouchCollector()

    collector.observe(buildAssistantToolUseRecord({ toolUseId: 'toolu_7', toolName: 'Edit' }))
    collector.observe(buildUserToolResultRecord({ toolUseId: 'toolu_7' }))

    expect(collector.touches()).toEqual([])
  })

  it('ignores records with no message content, without throwing', () => {
    const collector = createFileTouchCollector()

    expect(() => collector.observe({ type: 'assistant' })).not.toThrow()
    expect(() => collector.observe({ type: 'user' })).not.toThrow()
    expect(collector.touches()).toEqual([])
  })
})

describe('createFileTouchCollector weight', () => {
  it('is zero before anything is observed', () => {
    expect(createFileTouchCollector().weight()).toBe(0)
  })

  it('charges a tracked tool call that is still waiting for its result', () => {
    const collector = createFileTouchCollector()
    collector.observe(buildAssistantToolUseRecord({ toolUseId: 'toolu_1', toolName: 'Edit' }))

    expect(collector.weight()).toBe(FILE_TOUCH_ENTRY_OVERHEAD + 'toolu_1'.length + 'Edit'.length)
  })

  it('does not charge a call to a tool whose results are not tracked', () => {
    const collector = createFileTouchCollector()
    collector.observe(buildAssistantToolUseRecord({ toolUseId: 'toolu_1', toolName: 'Read' }))

    expect(collector.weight()).toBe(0)
  })

  it('charges a touch for its path and tool call id, and no longer the call that produced it', () => {
    const collector = createFileTouchCollector()
    collector.observe(buildAssistantToolUseRecord({ toolUseId: 'toolu_1', toolName: 'Edit' }))
    collector.observe(
      buildUserToolResultRecord({
        toolUseId: 'toolu_1',
        toolUseResult: buildEditToolUseResult('/a.ts')
      })
    )

    expect(collector.weight()).toBe(FILE_TOUCH_ENTRY_OVERHEAD + '/a.ts'.length + 'toolu_1'.length)
  })

  it('stops charging a call once its result arrives, even when the result is no touch', () => {
    const collector = createFileTouchCollector()
    collector.observe(buildAssistantToolUseRecord({ toolUseId: 'toolu_1', toolName: 'Edit' }))
    collector.observe(
      buildUserToolResultRecord({ toolUseId: 'toolu_1', toolUseResult: 'a string, a failed call' })
    )

    expect(collector.weight()).toBe(0)
  })

  it('charges the id of a Bash result whose file list may be incomplete', () => {
    const collector = createFileTouchCollector()
    collector.observe(buildAssistantToolUseRecord({ toolUseId: 'toolu_b', toolName: 'Bash' }))
    collector.observe(
      buildUserToolResultRecord({
        toolUseId: 'toolu_b',
        toolUseResult: buildBashToolUseResult({ unavailable: true })
      })
    )

    expect(collector.weight()).toBe(FILE_TOUCH_ENTRY_OVERHEAD + 'toolu_b'.length)
  })

  it('charges for every call left waiting, so a crafted transcript weighs what it holds', () => {
    const collector = createFileTouchCollector()
    for (let n = 0; n < 1000; n += 1) {
      collector.observe(buildAssistantToolUseRecord({ toolUseId: `toolu_${n}`, toolName: 'Bash' }))
    }

    const perCall = FILE_TOUCH_ENTRY_OVERHEAD + 'Bash'.length
    const ids = Array.from({ length: 1000 }, (_, n) => `toolu_${n}`.length)
    expect(collector.weight()).toBe(1000 * perCall + ids.reduce((sum, length) => sum + length, 0))
  })
})
