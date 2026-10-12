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
  test(`the pane says there is nothing yet on ${surface}`, async ($) => {
    const pane = await $.ui.mount({
      plugin: 'beekeeper',
      surface,
      component: 'Pane',
      requestId: 'beekeeper',
      props: PANE_PROPS
    })

    expect(await pane.find({ type: 'Text', text: 'Nothing here yet.' })).toBeDefined()
  })
}

test('session.start registers /beekeeper on a current Claude Code', async ($, on) => {
  const registered: string[] = []
  const toasts: string[] = []
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
  on('ui.toast', async (_$, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })

  expect(toasts).toEqual([])
  expect(registered).toEqual(['beekeeper'])
})

test('session.start toasts and registers nothing on a Claude Code that is too old', async ($, on) => {
  const registered: string[] = []
  const toasts: string[] = []
  mock.env(on, { HOME: '/home/u' })
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  on('session.version', async () => ({ value: { version: '2.1.200', base: '2.1.200' } }))
  on('command.register', async (_$, e) => {
    registered.push(e.name)
    return { value: { command: e.name } }
  })
  on('ui.toast', async (_$, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })

  expect(registered).toEqual([])
  expect(toasts).toEqual(['beekeeper needs Claude Code 2.1.296 or later. This is 2.1.200.'])
})
