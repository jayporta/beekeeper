import { expect, mock, test } from 'claude-code/testing'

const PANE_PROPS = { title: 'beekeeper', isFocused: true, bodyColumns: 60 }

test('/beekeeper opens the pane and replies with one line', async ($, on) => {
  const opened: string[] = []
  on('ui.open', async (_$, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true } }
  })

  const reply = await $.command.run({ command: 'beekeeper', args: '' })

  expect(reply).toEqual({ text: 'beekeeper pane opened.' })
  expect(opened).toEqual(['beekeeper'])
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`the pane says it is loading when nothing is stored on ${surface}`, async ($) => {
    const pane = await $.ui.mount({
      plugin: 'beekeeper',
      surface,
      component: 'Pane',
      requestId: 'beekeeper',
      props: PANE_PROPS
    })

    expect(await pane.find({ type: 'Text', text: 'Loading the session.' })).toBeDefined()
  })
}

const SESSION = '11111111-1111-4111-8111-111111111111'
const PROJECTS = '/home/u/.claude/projects'
const TRANSCRIPT = [
  JSON.stringify({ type: 'ai-title', aiTitle: 'Smoke title' }),
  JSON.stringify({
    type: 'assistant',
    timestamp: '2026-01-01T00:00:00.000Z',
    message: { id: 'msg_1', model: 'claude-opus-5', usage: { input_tokens: 5, output_tokens: 10 } }
  })
].join('\n')
const FILES: Record<string, string> = { [`${PROJECTS}/-work/${SESSION}.jsonl`]: TRANSCRIPT }

/** The names directly under a directory of the fake file system, or undefined when it isn't one. */
function childrenOf(dir: string): string[] | undefined {
  const names = new Set<string>()
  for (const path of Object.keys(FILES)) {
    if (path.startsWith(`${dir}/`)) names.add(path.slice(dir.length + 1).split('/')[0] ?? '')
  }
  return names.size > 0 ? [...names] : undefined
}

const missing = (): Error => Object.assign(new Error('no such file'), { code: 'ENOENT' })

/** Answers everything a refresh asks of the engine from the fake file system above; returns the clock. */
function mockSession(on: Parameters<typeof mock.env>[0]): {
  clock: ReturnType<typeof mock.clock>
  isPaneOpen: { value: boolean }
} {
  const isPaneOpen = { value: true }
  const clock = mock.clock(on)
  mock.env(on, { HOME: '/home/u' })
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  on('session.version', async () => ({ value: { version: '2.1.296', base: '2.1.296' } }))
  on('session.id', async () => ({ value: SESSION }))
  on('session.root', async () => ({ value: '/work' }))
  on('process.run', async () => ({
    value: {
      exitCode: 0,
      stdout: 'Darwin\n',
      stderr: '',
      isStdoutTruncated: false,
      isStderrTruncated: false
    }
  }))
  on('command.register', async (_$, e) => ({ value: { command: e.name } }))
  on('ui.open', async () => ({ value: { isPlaced: true } }))
  on('ui.panes', async () => ({
    value: isPaneOpen.value
      ? [{ id: 'beekeeper', title: 'beekeeper', isFocused: true, isPlaced: true }]
      : []
  }))
  on('fs.stat', async (_$, e) => {
    const content = FILES[e.path]
    if (content !== undefined) {
      return {
        value: {
          kind: 'file' as const,
          size: content.length,
          mtimeMs: 1000,
          isLink: false,
          realPath: e.path
        }
      }
    }
    if (e.path === '/home/u/.claude' || childrenOf(e.path) !== undefined) {
      return {
        value: { kind: 'dir' as const, size: 0, mtimeMs: 1000, isLink: false, realPath: e.path }
      }
    }
    throw missing()
  })
  on('fs.list', async (_$, e) => {
    const names = childrenOf(e.path)
    if (names === undefined) throw missing()
    return {
      value: names.map((name) => ({
        name,
        kind: name.endsWith('.jsonl') ? ('file' as const) : ('dir' as const),
        size: 0,
        mtimeMs: 1000,
        isLink: false
      }))
    }
  })
  on('fs.read', async (_$, e) => {
    const content = FILES[e.path]
    if (content === undefined) throw missing()
    return { value: { base64: btoa(content) } }
  })
  return { clock, isPaneOpen }
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`/beekeeper shows the session's agents as rows on ${surface}`, async ($, on) => {
    const { clock } = mockSession(on)

    await $.session.start({ cwd: '/work', surface, isInteractive: true })
    await $.command.run({ command: 'beekeeper', args: '' })
    await clock.advance(1)
    const pane = await $.ui.mount({
      plugin: 'beekeeper',
      surface,
      component: 'Pane',
      requestId: 'beekeeper',
      props: PANE_PROPS
    })

    expect(await pane.find({ type: 'Button', key: 'lead' })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: 'Smoke title' })).toBeDefined()
  })

  test(`a pane mounted with nothing stored refreshes itself on ${surface}`, async ($, on) => {
    const { clock, isPaneOpen } = mockSession(on)
    isPaneOpen.value = false
    await $.session.start({ cwd: '/work', surface, isInteractive: true })
    isPaneOpen.value = true

    const pane = await $.ui.mount({
      plugin: 'beekeeper',
      surface,
      component: 'Pane',
      requestId: 'beekeeper',
      props: PANE_PROPS
    })
    expect(await pane.find({ type: 'Text', text: 'Loading the session.' })).toBeDefined()
    await clock.advance(1)

    expect(await pane.find({ type: 'Button', key: 'lead' })).toBeDefined()
  })
}

test('session.start registers /beekeeper on a current Claude Code', async ($, on) => {
  const registered: string[] = []
  const statuses: string[] = []
  mock.env(on, { HOME: '/home/u' })
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  on('session.version', async () => ({ value: { version: '2.1.296', base: '2.1.296' } }))
  on('fs.stat', async (_$, e) => ({
    value: { kind: 'dir' as const, size: 0, mtimeMs: 0, isLink: false, realPath: e.path }
  }))
  on('process.run', async () => ({
    value: {
      exitCode: 0,
      stdout: 'Darwin\n',
      stderr: '',
      isStdoutTruncated: false,
      isStderrTruncated: false
    }
  }))
  on('command.register', async (_$, e) => {
    registered.push(e.name)
    return { value: { command: e.name } }
  })
  on('ui.status', async (_$, e) => {
    statuses.push(e.text ?? '')
    return { value: undefined }
  })

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })

  expect(statuses).toEqual([])
  expect(registered).toEqual(['beekeeper'])
})

test('session.start sets the status line and registers nothing on a Claude Code that is too old', async ($, on) => {
  const registered: string[] = []
  const statuses: string[] = []
  mock.env(on, { HOME: '/home/u' })
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  on('session.version', async () => ({ value: { version: '2.1.200', base: '2.1.200' } }))
  on('command.register', async (_$, e) => {
    registered.push(e.name)
    return { value: { command: e.name } }
  })
  on('ui.status', async (_$, e) => {
    statuses.push(e.text ?? '')
    return { value: undefined }
  })

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })

  expect(registered).toEqual([])
  expect(statuses).toEqual(['beekeeper needs Claude Code 2.1.296 or later. This is 2.1.200.'])
})
