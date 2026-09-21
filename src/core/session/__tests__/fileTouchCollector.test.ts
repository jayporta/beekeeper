import { describe, expect, it } from 'vitest'
import {
  buildAssistantToolUseRecord,
  buildEditToolUseResult,
  buildToolResultBlock,
  buildUserToolResultRecord,
  buildWriteToolUseResult
} from '../../transcript/testFileTouchFixtures'
import { createFileTouchCollector } from '../fileTouchCollector'

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
      { filePath: '/a.ts', operation: 'edit', toolUseId: 'toolu_1' }
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
      { filePath: '/new.ts', operation: 'create', toolUseId: 'toolu_2' }
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
      { filePath: '/existing.ts', operation: 'update', toolUseId: 'toolu_3' }
    ])
  })

  it('ignores a tool not tracked for file touches, such as Bash', () => {
    const collector = createFileTouchCollector()

    collector.observe(buildAssistantToolUseRecord({ toolUseId: 'toolu_4', toolName: 'Bash' }))
    collector.observe(
      buildUserToolResultRecord({ toolUseId: 'toolu_4', toolUseResult: { filePath: '/a.ts' } })
    )

    expect(collector.touches()).toEqual([])
  })

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
