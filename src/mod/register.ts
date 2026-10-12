import type { Engine, Register } from 'claude-code'
import {
  EmptyPane,
  MINIMUM_CLAUDE_CODE,
  isAllowedArgv,
  startMod,
  t,
  type ModHost,
  type StartOutcome
} from './lib.js'

const PANE_ID = 'beekeeper'

/** The names among the git repository variables that Claude Code's environment sets, even to empty. */
async function gitRepoVariablesSet($: Engine): Promise<string[]> {
  const found = await Promise.all([
    $.env.get('GIT_DIR').then((value) => ['GIT_DIR', value] as const),
    $.env.get('GIT_WORK_TREE').then((value) => ['GIT_WORK_TREE', value] as const),
    $.env.get('GIT_COMMON_DIR').then((value) => ['GIT_COMMON_DIR', value] as const),
    $.env.get('GIT_INDEX_FILE').then((value) => ['GIT_INDEX_FILE', value] as const),
    $.env.get('GIT_OBJECT_DIRECTORY').then((value) => ['GIT_OBJECT_DIRECTORY', value] as const),
    $.env
      .get('GIT_ALTERNATE_OBJECT_DIRECTORIES')
      .then((value) => ['GIT_ALTERNATE_OBJECT_DIRECTORIES', value] as const),
    $.env.get('GIT_NAMESPACE').then((value) => ['GIT_NAMESPACE', value] as const)
  ])
  return found.filter(([, value]) => value !== undefined).map(([name]) => name)
}

/** The mod's only `$` calls, as closures lib can use without seeing `$`. */
export function hostOf($: Engine): ModHost {
  return {
    version: () => $.session.version(),
    readBytes: async (path) =>
      Uint8Array.fromBase64((await $.fs.read(path, { as: 'bytes' })).base64),
    list: (path) => $.fs.list(path),
    runGit: async ({ file, args, env, timeoutMs }) => {
      if (!isAllowedArgv(file, args)) throw new RangeError('argv is not allowed')
      return $.process.run([file, ...args], { env, timeoutMs })
    },
    osName: async () => (await $.process.run(['uname', '-s'])).stdout,
    configDir: () => $.env.get('CLAUDE_CONFIG_DIR'),
    home: () => $.env.get('HOME'),
    gitRepoVariablesSet: () => gitRepoVariablesSet($),
    stat: (path) => $.fs.stat(path, { resolve: true }),
    tail: (path, start) => {
      if (!Number.isSafeInteger(start) || start < 0) throw new RangeError('start is not an offset')
      if (!path.startsWith('/')) throw new RangeError('path is not absolute')
      return $.process.spawn({ argv: ['tail', '-c', `+${start + 1}`, path] })
    }
  }
}

/** Shows what starting came to: registers `/beekeeper` when ready, or toasts fixed text when not. */
async function announce($: Engine, outcome: StartOutcome): Promise<void> {
  if (outcome.kind === 'ready') {
    await $.command.register({ name: 'beekeeper', description: t('command.description') })
  } else if (outcome.kind === 'too-old') {
    $.ui.toast(t('start.tooOld', { minimum: MINIMUM_CLAUDE_CODE, version: outcome.version }))
  } else {
    $.ui.toast(t('start.failed'))
  }
}

/** Registers the mod's hooks with the engine. */
export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    const outcome = await startMod(hostOf($), { cwd: e.cwd })
    if (e.isInteractive) await announce($, outcome)
    return started
  }).catch(($, e, next) => next(e))
  on('command.run', { command: 'beekeeper' }, async ($) => {
    await $.ui.open({ id: PANE_ID, title: t('pane.title') })
    return { text: t('command.opened') }
  })
  on('ui.render', { component: 'Pane', requestId: PANE_ID }, async ($, e) =>
    EmptyPane($.ui.resolve(e))
  )
}
