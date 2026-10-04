import { describe, expect, it } from 'vitest'
import type { AgentNodeDto } from '../../../../../../shared/ipc/agentDto'
import { testRef } from '@renderer/features/sessions/testSessionFixtures'
import { testDetail, testMeta, testNode, testReport } from '../../testSessionDetail'
import { inspectionOf } from '../inspectionOf'

const OWNER = testRef(1)
const lead = testReport({ messageCount: 9 })
const sub = testReport({ messageCount: 4 })

describe('inspectionOf the owner’s own agent', () => {
  const target = { ownerRef: OWNER, agentId: null }

  it('is loading until the detail arrives', () => {
    expect(inspectionOf(target, { data: undefined, isError: false })).toEqual({ status: 'loading' })
  })

  it('is unreadable when the detail failed and none was loaded', () => {
    expect(inspectionOf(target, { data: undefined, isError: true })).toEqual({
      status: 'unreadable'
    })
  })

  it('is the lead’s report, with no worktree branch', () => {
    const data = testDetail({ lead })

    expect(inspectionOf(target, { data, isError: false })).toEqual({
      status: 'ready',
      report: lead,
      worktreeBranch: null
    })
  })

  it('keeps a loaded detail when a refresh failed', () => {
    const data = testDetail({ lead })

    expect(inspectionOf(target, { data, isError: true }).status).toBe('ready')
  })
})

describe('inspectionOf a subagent', () => {
  const target = { ownerRef: OWNER, agentId: 'a1' }

  it('is that subagent’s report', () => {
    const data = testDetail({
      children: [testNode('a0'), testNode('a1')],
      reports: { a0: testReport({ messageCount: 1 }), a1: sub }
    })

    expect(inspectionOf(target, { data, isError: false })).toMatchObject({
      status: 'ready',
      report: sub
    })
  })

  it('has the worktree branch its meta names', () => {
    const data = testDetail({
      children: [testNode('a1', { meta: testMeta({ worktreeBranch: 'feature/x' }) })]
    })

    expect(inspectionOf(target, { data, isError: false })).toMatchObject({
      worktreeBranch: 'feature/x'
    })
  })

  it('finds a subagent nested deep under others, and its meta', () => {
    let tail: AgentNodeDto = testNode('a1', { meta: testMeta({ worktreeBranch: 'deep' }) })
    for (let i = 0; i < 5000; i += 1) tail = testNode(`n${i}`, { children: [tail] })
    const data = testDetail({ children: [tail] })

    expect(inspectionOf(target, { data, isError: false })).toMatchObject({
      status: 'ready',
      worktreeBranch: 'deep'
    })
  })

  it('has no branch when its meta is absent or unreadable', () => {
    const data = testDetail({ children: [testNode('a1', { meta: { status: 'absent' } })] })

    expect(inspectionOf(target, { data, isError: false })).toMatchObject({ worktreeBranch: null })
  })

  it('is unreadable when its report could not be read', () => {
    const data = testDetail({ children: [testNode('a1')], reports: { a1: 'error' } })

    expect(inspectionOf(target, { data, isError: false })).toEqual({ status: 'unreadable' })
  })

  it('is unreadable when the subagents folder could not be read', () => {
    const data = testDetail({ children: [testNode('a1')], reports: false })

    expect(inspectionOf(target, { data, isError: false })).toEqual({ status: 'unreadable' })
  })

  it('is unreadable for a subagent the detail does not hold', () => {
    const data = testDetail({ children: [testNode('other')] })

    expect(inspectionOf(target, { data, isError: false })).toEqual({ status: 'unreadable' })
  })
})
