import { Bee } from './bee.js'
import { drawBee, drawTrail } from './drawBee.js'
import { createLineupView } from './lineupView.js'
import { Swarm } from './swarm.js'

const SPAWN_INTERVAL_MS = 5000
/** Bees that leave the origin in a quick burst, before the usual spawn pace. */
const BURST_COUNT = 4
const BURST_INTERVAL_MS = 160
/** How often lineup cards refresh their times. */
const LINEUP_REFRESH_MS = 100
/** Longest frame step, so bees don't jump after the tab was in the background. */
const MAX_FRAME_SECONDS = 0.05
/** Farthest a pointer can travel between press and release and still count as a tap, not a swipe. */
const TAP_MOVEMENT_THRESHOLD_PX = 10

/**
 * Where the bees' game runs and how it starts.
 * @typedef {object} GameOptions
 * @property {HTMLCanvasElement} canvas - A full-viewport canvas the bees fly on.
 * @property {HTMLElement} lineupLayer - A full-viewport layer for the lined-up bees' cards.
 * @property {() => { x: number, y: number }} [getOrigin] - Where bees come out of and fly back to, in viewport pixels. Without it, bees fly in from the page edges and can't be dismissed.
 */

/**
 * Creates the bees game: bees that fly over the page, can be caught into a lineup at the top, and
 * can be released again. Nothing runs until `start`.
 * @param {GameOptions} options - The elements to draw into, and an optional origin.
 * @returns {{ start: () => void, dismiss: () => Promise<void>, destroy: () => void }} `start` begins the game, `dismiss` flies every bee back to the origin and ends the game, and `destroy` ends it at once and removes everything it added to the page.
 */
export function createGame({ canvas, lineupLayer, getOrigin }) {
  const context = canvas.getContext('2d')
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const darkScheme = window.matchMedia('(prefers-color-scheme: dark)')
  const listeners = new AbortController()
  const { signal } = listeners

  const swarm = new Swarm()
  const bounds = { width: 0, height: 0 }
  const lineupView = createLineupView({
    layer: lineupLayer,
    onRelease: (bee) => {
      swarm.release(bee, bounds)
      refreshLineup([bee])
    }
  })
  let colors = readColors()
  let frameId = 0
  let spawnTimer = 0
  let lineupTimer = 0
  let lastTime = 0
  let dismissing = false
  let finishDismiss = null
  /** Where the pointer was last seen, for showing a pointer cursor over bees. */
  let pointer = null
  /** Where each active pointer went down, keyed by pointer id, so a swipe that ends over a bee doesn't catch it. */
  const pointerDownAt = new Map()

  function readColors() {
    const style = getComputedStyle(document.documentElement)
    const token = (name) => style.getPropertyValue(name).trim()
    return {
      body: token('--bee-body'),
      stripe: token('--bee-stripe'),
      wing: token('--bee-wing'),
      vein: token('--bee-vein'),
      shine: token('--bee-shine'),
      trail: token('--bee-trail'),
      outline: token('--bee-outline')
    }
  }

  function resize() {
    const ratio = window.devicePixelRatio || 1
    bounds.width = window.innerWidth
    bounds.height = window.innerHeight
    canvas.width = Math.round(bounds.width * ratio)
    canvas.height = Math.round(bounds.height * ratio)
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    refreshLineup(swarm.fit(bounds))
  }

  function render() {
    context.clearRect(0, 0, bounds.width, bounds.height)
    for (const bee of swarm.bees)
      drawTrail(context, { trail: bee.trail.points, color: colors.trail })
    for (const bee of swarm.bees) drawBee(context, { bee, colors })
  }

  /**
   * Redraws and brings the lineup cards up to date. With reduced motion, lined-up bees and the
   * given just-released bees jump to their spots instead of flying there.
   */
  function refreshLineup(released = []) {
    if (reducedMotion.matches) swarm.settle(released)
    render()
    lineupView.sync({ swarm, bounds })
  }

  function updateCursor() {
    const overBee = pointer !== null && swarm.beeAt(pointer) !== null
    document.documentElement.classList.toggle('over-bee', overBee)
  }

  function frame(time) {
    const dt = lastTime ? Math.min((time - lastTime) / 1000, MAX_FRAME_SECONDS) : 0
    lastTime = time
    if (dismissing) swarm.recall(getOrigin())
    swarm.update(dt, bounds)
    updateCursor()
    render()
    lineupView.sync({ swarm, bounds })
    if (dismissing && swarm.bees.length === 0) {
      destroy()
      return
    }
    frameId = requestAnimationFrame(frame)
  }

  /** Spawns a bee every few seconds until the swarm is full, with a quick burst first at the origin. */
  function scheduleSpawn() {
    if (swarm.isFull || dismissing) return
    const bursting = getOrigin && swarm.bees.length < BURST_COUNT
    spawnTimer = window.setTimeout(
      () => {
        swarm.spawn(bounds, getOrigin?.())
        scheduleSpawn()
      },
      bursting ? BURST_INTERVAL_MS : SPAWN_INTERVAL_MS
    )
  }

  function fly() {
    if (swarm.bees.length === 0) swarm.spawn(bounds, getOrigin?.())
    lastTime = 0
    frameId = requestAnimationFrame(frame)
    scheduleSpawn()
  }

  function holdStill() {
    if (swarm.bees.length === 0) {
      const origin = getOrigin?.()
      const spot = origin
        ? { x: origin.x, y: origin.y - 80 }
        : { x: bounds.width * 0.22, y: bounds.height * 0.28 }
      swarm.add(new Bee({ ...spot, facing: 1 }))
      swarm.fit(bounds)
    }
    refreshLineup()
  }

  /**
   * Flies the swarm, or holds it still when reduced motion is on. Everything stops while the page
   * is hidden, so bees don't pile up waiting to spawn.
   */
  function applyMotionPreference() {
    cancelAnimationFrame(frameId)
    window.clearTimeout(spawnTimer)
    if (document.hidden) {
      if (dismissing) destroy()
      return
    }
    if (reducedMotion.matches) {
      if (dismissing) destroy()
      else holdStill()
    } else fly()
  }

  /** Catches the bee under a tap or primary-button click. Buttons and links handle their own clicks. */
  function catchBee(event) {
    const from = pointerDownAt.get(event.pointerId)
    pointerDownAt.delete(event.pointerId)
    if (dismissing || event.button !== 0) return
    if (event.target instanceof Element && event.target.closest('button, a')) return
    if (
      from &&
      Math.hypot(event.clientX - from.x, event.clientY - from.y) > TAP_MOVEMENT_THRESHOLD_PX
    ) {
      return
    }
    const bee = swarm.beeAt({ x: event.clientX, y: event.clientY })
    if (!bee) return
    swarm.catch(bee, bounds)
    refreshLineup()
  }

  function start() {
    resize()
    applyMotionPreference()
    lineupTimer = window.setInterval(() => lineupView.sync({ swarm, bounds }), LINEUP_REFRESH_MS)
    window.addEventListener('resize', resize, { signal })
    window.addEventListener(
      'pointerdown',
      (event) => pointerDownAt.set(event.pointerId, { x: event.clientX, y: event.clientY }),
      { signal }
    )
    window.addEventListener('pointerup', catchBee, { signal })
    window.addEventListener('pointercancel', (event) => pointerDownAt.delete(event.pointerId), {
      signal
    })
    window.addEventListener(
      'pointermove',
      (event) => {
        pointer = { x: event.clientX, y: event.clientY }
        updateCursor()
      },
      { signal }
    )
    document.documentElement.addEventListener(
      'pointerleave',
      () => {
        pointer = null
        updateCursor()
      },
      { signal }
    )
    document.addEventListener('visibilitychange', applyMotionPreference, { signal })
    reducedMotion.addEventListener('change', applyMotionPreference, { signal })
    darkScheme.addEventListener(
      'change',
      () => {
        colors = readColors()
        render()
      },
      { signal }
    )
  }

  function dismiss() {
    if (dismissing) return Promise.resolve()
    dismissing = true
    window.clearTimeout(spawnTimer)
    return new Promise((resolve) => {
      finishDismiss = resolve
      applyMotionPreference()
    })
  }

  function destroy() {
    listeners.abort()
    cancelAnimationFrame(frameId)
    window.clearTimeout(spawnTimer)
    window.clearInterval(lineupTimer)
    lineupLayer.replaceChildren()
    context.clearRect(0, 0, bounds.width, bounds.height)
    document.documentElement.classList.remove('over-bee')
    finishDismiss?.()
  }

  return { start, dismiss, destroy }
}
