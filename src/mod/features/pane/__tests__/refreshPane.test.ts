import { describe, expect, it } from 'vitest'
import {
  testDetail,
  testMeta,
  testNode,
  testReport,
  testTokenGroup
} from '../../../../shared/agentGraph/testSessionDetail'
import type { AgentReportDto } from '../../../../shared/ipc/agentDto'
import {
  testAgentRole,
  testLeadTeam,
  testRef,
  testSession,
  testTeammateTeam
} from '../../../../shared/sessions/testSessionFixtures'
import type { PaneNode } from '../paneView'
import { refreshPane } from '../refreshPane'
import { testPaneServices } from '../testPaneServices'

const REF = testRef(1)
const NOW = 5000

const spent = (output: number, extra: Partial<AgentReportDto> = {}): AgentReportDto =>
  testReport({ tokenGroups: [testTokenGroup({ output })], ...extra })

const lead = testSession(1, { title: 'Fix the bug' })

function names(node: PaneNode): string[] {
  return [node.name, ...node.children.flatMap(names)]
}

describe('refreshPane', () => {
  it('builds the tree of a lead with two subagents', async () => {
    const detail = testDetail({
      children: [
        testNode('a1', { meta: testMeta({ name: 'finder' }) }),
        testNode('a2', { meta: testMeta({ name: 'writer' }) })
      ],
      lead: spent(100)
    })
    const services = testPaneServices({
      list: { ok: true, value: [lead] },
      get: { ok: true, value: detail }
    })

    const { view } = await refreshPane(services, {
      ref: REF,
      withList: true,
      lastItems: null,
      nowMs: NOW
    })

    expect(view.status).toBe('ready')
    expect(view.label).toBe('Fix the bug')
    expect(view.refreshedAtMs).toBe(NOW)
    expect(view.root && names(view.root)).toEqual(['Lead', 'finder', 'writer'])
  })

  it('totals the tokens of the lead and its subagents once', async () => {
    const detail = testDetail({
      children: [testNode('a1')],
      lead: spent(100),
      reports: { a1: spent(40) }
    })
    const services = testPaneServices({
      list: { ok: true, value: [lead] },
      get: { ok: true, value: detail }
    })

    const { view } = await refreshPane(services, {
      ref: REF,
      withList: true,
      lastItems: null,
      nowMs: NOW
    })

    expect(view.totalTokens).toBe(140)
  })

  it('gives the lead and each subagent the files its report lists', async () => {
    const touch = (filePath: string): AgentReportDto['fileTouches'][number] => ({
      filePath,
      operation: 'edit',
      source: 'edit-write'
    })
    const detail = testDetail({
      children: [testNode('a1')],
      lead: testReport({ fileTouches: [touch('/lead.ts')] }),
      reports: { a1: testReport({ fileTouches: [touch('/sub.ts')], fileListIncomplete: true }) }
    })
    const services = testPaneServices({
      list: { ok: true, value: [lead] },
      get: { ok: true, value: detail }
    })

    const { view } = await refreshPane(services, {
      ref: REF,
      withList: true,
      lastItems: null,
      nowMs: NOW
    })

    expect(view.root?.files).toEqual([{ path: '/lead.ts', operation: 'edit' }])
    expect(view.root?.children[0]?.files).toEqual([{ path: '/sub.ts', operation: 'edit' }])
    expect(view.root?.children[0]?.filesIncomplete).toBe(true)
  })

  it('marks a subagent whose report is unreadable as having an incomplete, empty file list', async () => {
    const detail = testDetail({ children: [testNode('a1')], reports: { a1: 'error' } })
    const services = testPaneServices({
      list: { ok: true, value: [lead] },
      get: { ok: true, value: detail }
    })

    const { view } = await refreshPane(services, {
      ref: REF,
      withList: true,
      lastItems: null,
      nowMs: NOW
    })

    expect(view.root?.children[0]?.files).toEqual([])
    expect(view.root?.children[0]?.filesIncomplete).toBe(true)
  })

  it('leaves the files of a teammate and of a workflow run unset', async () => {
    const withTeam = testSession(1, { title: 'Lead', team: testLeadTeam([testRef(2)]) })
    const mate = testSession(2, {
      role: testAgentRole('writer', 'code'),
      team: testTeammateTeam(REF)
    })
    const detail = testDetail({
      children: [testNode('w1', { workflowRunId: 'wf_a' })],
      workflowRuns: [{ runId: 'wf_a', record: { name: 'flow', completed: true, phases: [] } }]
    })
    const services = testPaneServices({
      list: { ok: true, value: [withTeam, mate] },
      get: { ok: true, value: detail }
    })

    const { view } = await refreshPane(services, {
      ref: REF,
      withList: true,
      lastItems: null,
      nowMs: NOW
    })

    const kinds = Object.fromEntries(
      (view.root?.children ?? []).map((child) => [child.kind, child.files])
    )
    expect(kinds).toEqual({ workflow: null, teammate: null })
  })

  it('cleans control characters out of agent names and file paths', async () => {
    const detail = testDetail({
      children: [testNode('a1', { meta: testMeta({ name: 'evil\u001b[2J\nname' }) })],
      reports: {
        a1: testReport({
          fileTouches: [{ filePath: '/a‮b\n.ts', operation: 'create', source: 'bash' }]
        })
      }
    })
    const services = testPaneServices({
      list: { ok: true, value: [lead] },
      get: { ok: true, value: detail }
    })

    const { view } = await refreshPane(services, {
      ref: REF,
      withList: true,
      lastItems: null,
      nowMs: NOW
    })

    const child = view.root?.children[0]
    expect(child?.name).toBe('evil [2J name')
    expect(child?.files).toEqual([{ path: '/a b .ts', operation: 'create' }])
  })

  it('cleans the session label', async () => {
    const dirty = testSession(1, { title: 'Fix\nit' })
    const services = testPaneServices({
      list: { ok: true, value: [dirty] },
      get: { ok: true, value: testDetail() }
    })

    const { view } = await refreshPane(services, {
      ref: REF,
      withList: true,
      lastItems: null,
      nowMs: NOW
    })

    expect(view.label).toBe('Fix it')
  })

  it('lists the sessions when asked and hands the items back', async () => {
    const services = testPaneServices({
      list: { ok: true, value: [lead] },
      get: { ok: true, value: testDetail() }
    })

    const { items } = await refreshPane(services, {
      ref: REF,
      withList: true,
      lastItems: null,
      nowMs: NOW
    })

    expect(services.listCalls).toBe(1)
    expect(items).toEqual([lead])
  })

  it('reuses the last items instead of listing when not asked to', async () => {
    const services = testPaneServices({
      list: new Error('must not list'),
      get: { ok: true, value: testDetail() }
    })

    const { view, items } = await refreshPane(services, {
      ref: REF,
      withList: false,
      lastItems: [lead],
      nowMs: NOW
    })

    expect(services.listCalls).toBe(0)
    expect(items).toEqual([lead])
    expect(view.label).toBe('Fix the bug')
  })

  it('turns a service error into an error view carrying only its code', async () => {
    const services = testPaneServices({
      list: { ok: true, value: [lead] },
      get: { ok: false, error: { code: 'not-found' } }
    })

    const { view } = await refreshPane(services, {
      ref: REF,
      withList: true,
      lastItems: null,
      nowMs: NOW
    })

    expect(view).toMatchObject({ status: 'error', errorCode: 'not-found', root: null })
  })

  it('turns a failed list into an error view and keeps the last items', async () => {
    const services = testPaneServices({
      list: { ok: false, error: { code: 'unreadable' } },
      get: { ok: true, value: testDetail() }
    })

    const { view, items } = await refreshPane(services, {
      ref: REF,
      withList: true,
      lastItems: [lead],
      nowMs: NOW
    })

    expect(view).toMatchObject({ status: 'error', errorCode: 'unreadable' })
    expect(items).toEqual([lead])
  })

  it('never rejects: a thrown service becomes an internal error without its message', async () => {
    const services = testPaneServices({
      list: { ok: true, value: [lead] },
      get: new Error('secret /home/u/path')
    })

    const { view } = await refreshPane(services, {
      ref: REF,
      withList: true,
      lastItems: null,
      nowMs: NOW
    })

    expect(view).toMatchObject({ status: 'error', errorCode: 'internal' })
    expect(JSON.stringify(view)).not.toContain('secret')
  })

  it('rejects a ref that is not a session before calling a service', async () => {
    const services = testPaneServices({
      list: { ok: true, value: [lead] },
      get: { ok: true, value: testDetail() }
    })

    const { view } = await refreshPane(services, {
      ref: { projectDirName: '../x', sessionId: 'nope' },
      withList: true,
      lastItems: null,
      nowMs: NOW
    })

    expect(view).toMatchObject({ status: 'error', errorCode: 'invalid-request' })
    expect(services.listCalls + services.getCalls).toBe(0)
  })
})
