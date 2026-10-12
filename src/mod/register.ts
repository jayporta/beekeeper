import type { Engine, Register } from 'claude-code'
import {
  EmptyPane,
  MINIMUM_CLAUDE_CODE,
  startMod,
  t,
  type ModHost,
  type StartOutcome
} from './lib.js'

const PANE_ID = 'beekeeper'

/** The mod's only `$` calls, as closures lib can use without seeing `$`. */
export function hostOf($: Engine): ModHost {
  return { version: () => $.session.version() }
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
    const outcome = await startMod(hostOf($))
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
