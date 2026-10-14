import type { Engine, PaneRenderInput, Register } from 'claude-code'
import {
  Pane,
  MINIMUM_CLAUDE_CODE,
  createPaneRefresher,
  createPaneScheduler,
  isAllowedArgv,
  t,
  type ModHost,
  type PaneRefresher,
  type PaneSelection,
  type PaneScheduler,
  type PaneNav,
  type PaneView,
  type StartOutcome
} from './lib.js'

const PANE_ID = 'beekeeper'

/** How long a turn or a spawn waits before the pane refreshes, so a burst of them costs one refresh. */
const DEBOUNCE_MS = 1000

/** The `$.state` value the pane draws from. */
const VIEW = { plugin: 'beekeeper', key: 'view' } as const

/** The `$.state` value holding the node the person selected. */
const SELECTED = { plugin: 'beekeeper', key: 'selected' } as const

/** The `$.state` value holding which screen the pane shows. Only the pane's press handlers write it. */
const NAV = { plugin: 'beekeeper', key: 'nav' } as const

/** The `$.state` value the Browse screen draws from. */
const BROWSE = { plugin: 'beekeeper', key: 'browse' } as const

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
    $.env.get('GIT_NAMESPACE').then((value) => ['GIT_NAMESPACE', value] as const),
    $.env.get('GIT_ATTR_SOURCE').then((value) => ['GIT_ATTR_SOURCE', value] as const),
    $.env.get('GIT_REPLACE_REF_BASE').then((value) => ['GIT_REPLACE_REF_BASE', value] as const)
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

/** Shows what starting came to: registers `/beekeeper` when ready, or sets the status line to fixed text when not. */
async function announce($: Engine, outcome: StartOutcome): Promise<void> {
  if (outcome.kind === 'ready') {
    await $.command.register({ name: 'beekeeper', description: t('command.description') })
  } else if (outcome.kind === 'too-old') {
    $.ui.status(t('start.tooOld', { minimum: MINIMUM_CLAUDE_CODE, version: outcome.version }))
  } else {
    $.ui.status(t('start.failed'))
  }
}

/** What a loaded copy of the mod keeps between hooks: the refresh and the timers that drive it. */
interface PaneWiring {
  readonly refresher: PaneRefresher
  readonly scheduler: PaneScheduler
}

/** Whether the pane is open. */
async function isPaneOpen($: Engine): Promise<boolean> {
  return (await $.ui.panes()).some((pane) => pane.id === PANE_ID)
}

/** Writes a code-only line to the engine's log; never text from a transcript or an error. */
function logCode(code: string): void {
  console.error(`beekeeper: ${code}`)
}

/** Whether a render that finds no view may ask for a refresh: true until it has, and again once a view is stored. */
let wantsFirstView = true

/** Builds the refresh and scheduler over this `$`. Its timers belong to this loaded copy of the mod. */
function wire($: Engine): PaneWiring {
  const refresher = createPaneRefresher({
    host: hostOf($),
    pane: {
      sessionId: () => $.session.id(),
      sessionRoot: () => $.session.root(),
      now: () => $.clock.now(),
      nav: async () => (await $.state.get<PaneNav>(NAV)).value,
      writeView: async (view) => {
        const { isSet } = await $.state.set(VIEW, view)
        wantsFirstView = true
        return isSet
      },
      writeBrowse: async (view) => (await $.state.set(BROWSE, view)).isSet
    },
    log: logCode
  })
  const scheduler = createPaneScheduler({
    after: (ms, fn) => $.clock.after(ms, fn),
    every: (ms, fn) => $.clock.every(ms, fn),
    isPaneOpen: () => isPaneOpen($),
    wantsListTick: refresher.wantsListTick,
    refresh: refresher.refresh,
    log: logCode
  })
  return { refresher, scheduler }
}

/** The wiring of this loaded copy of the mod, built by the first hook that needs it. Module state, because `$` may only be passed to top-level functions. */
let wiring: PaneWiring | undefined

/** The wiring of this loaded copy, built over `$` on first use. */
function wired($: Engine): PaneWiring {
  wiring ??= wire($)
  return wiring
}

/** Schedules a debounced refresh, and restarts lost ticks, when the pane is open. */
async function refreshIfOpen($: Engine, withList: boolean): Promise<void> {
  if (!(await isPaneOpen($))) return
  const { scheduler } = wired($)
  scheduler.ensureTicks()
  scheduler.schedule({ withList, delayMs: DEBOUNCE_MS })
}

/**
 * Draws the pane from `$.state`. A pane drawn before any refresh asks for one,
 * once, through the timers a non-render hook set up; a render never builds them,
 * so none holds the render's `$`. With none yet, the next hook that does refreshes.
 */
async function drawPane($: Engine, e: PaneRenderInput): Promise<object> {
  const view = (await $.state.get<PaneView>(VIEW)).value
  const selected = (await $.state.get<PaneSelection | null>(SELECTED)).value ?? null
  if (view === undefined && wantsFirstView && wiring !== undefined) {
    wantsFirstView = false
    wiring.refresher.forgetStored()
    wiring.scheduler.schedule({ withList: true, delayMs: 0 })
  }
  return Pane({
    elements: $.ui.resolve(e),
    view,
    selected,
    onSelect: async (key) => {
      if (view !== undefined) await $.state.set(SELECTED, { sessionId: view.sessionId, key })
    }
  })
}

/** Registers the mod's hooks with the engine. */
export const register: Register = (on) => {
  wiring = undefined
  wantsFirstView = true

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    const { refresher, scheduler } = wired($)
    const outcome = await refresher.start(e.cwd)
    if (e.isInteractive) await announce($, outcome)
    if (outcome.kind === 'ready' && (await isPaneOpen($))) {
      scheduler.ensureTicks()
      scheduler.schedule({ withList: true, delayMs: 0 })
    }
    return started
  }).catch(($, e, next) => next(e))
  on('command.run', { command: 'beekeeper' }, async ($) => {
    const { isPlaced } = await $.ui.open({
      id: PANE_ID,
      title: t('pane.title'),
      focus: true,
      closeOnEscape: true
    })
    const { scheduler } = wired($)
    scheduler.ensureTicks()
    scheduler.schedule({ withList: true, delayMs: 0 })
    return { text: t(isPlaced ? 'command.opened' : 'command.waiting') }
  })
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    await refreshIfOpen($, false)
    return result
  }).catch(($, e, next) => next(e))
  on('agent.spawn', async ($, e, next) => {
    const result = await next(e)
    await refreshIfOpen($, true)
    return result
  }).catch(($, e, next) => next(e))
  on('session.end', async ($, e, next) => {
    const result = await next(e)
    if (e.reason === 'clear') {
      wired($).refresher.forgetStored()
      await refreshIfOpen($, true)
    }
    return result
  }).catch(($, e, next) => next(e))
  on('ui.render', { component: 'Pane', requestId: PANE_ID }, async ($, e) => drawPane($, e))
}
