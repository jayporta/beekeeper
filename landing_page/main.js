import { Bee } from './bee.js'
import { drawBee, drawTrail } from './drawBee.js'
import { createLineupView } from './lineupView.js'
import { Swarm } from './swarm.js'

const SPAWN_INTERVAL_MS = 5000
/** How often lineup cards refresh their times. */
const LINEUP_REFRESH_MS = 100
/** Longest frame step, so bees don't jump after the tab was in the background. */
const MAX_FRAME_SECONDS = 0.05

const canvas = document.querySelector('#swarm')
const context = canvas.getContext('2d')
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
const darkScheme = window.matchMedia('(prefers-color-scheme: dark)')

const swarm = new Swarm()
const bounds = { width: 0, height: 0 }
const lineupView = createLineupView({
  layer: document.querySelector('#lineup'),
  onRelease: (bee) => {
    swarm.release(bee, bounds)
    refreshLineup([bee])
  }
})
let colors = readColors()
let frameId = 0
let spawnTimer = 0
let lastTime = 0
/** Where the pointer was last seen, for showing a pointer cursor over bees. */
let pointer = null

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
  for (const bee of swarm.bees) drawTrail(context, { trail: bee.trail.points, color: colors.trail })
  for (const bee of swarm.bees) drawBee(context, { bee, colors })
}

/**
 * Redraws and brings the lineup cards up to date. With reduced motion, lined-up bees and the given
 * just-released bees jump to their spots instead of flying there.
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
  swarm.update(dt, bounds)
  updateCursor()
  render()
  frameId = requestAnimationFrame(frame)
}

/** Spawns a bee every few seconds until the swarm is full. */
function scheduleSpawn() {
  if (swarm.isFull) return
  spawnTimer = window.setTimeout(() => {
    swarm.spawn(bounds)
    scheduleSpawn()
  }, SPAWN_INTERVAL_MS)
}

function fly() {
  if (swarm.bees.length === 0) swarm.spawn(bounds)
  lastTime = 0
  frameId = requestAnimationFrame(frame)
  scheduleSpawn()
}

function holdStill() {
  if (swarm.bees.length === 0) {
    swarm.add(new Bee({ x: bounds.width * 0.22, y: bounds.height * 0.28, facing: 1 }))
  }
  refreshLineup()
}

/**
 * Flies the swarm, or holds it still when reduced motion is on. Everything stops while the page is
 * hidden, so bees don't pile up waiting to spawn.
 */
function applyMotionPreference() {
  cancelAnimationFrame(frameId)
  window.clearTimeout(spawnTimer)
  if (document.hidden) return
  if (reducedMotion.matches) holdStill()
  else fly()
}

/** Catches the bee under a click. Clicks on Release buttons are left to them. */
function catchBee(event) {
  if (event.target instanceof Element && event.target.closest('button')) return
  const bee = swarm.beeAt({ x: event.clientX, y: event.clientY })
  if (!bee) return
  swarm.catch(bee, bounds)
  refreshLineup()
}

resize()
applyMotionPreference()
window.addEventListener('resize', resize)
window.addEventListener('click', catchBee)
window.addEventListener('pointermove', (event) => {
  pointer = { x: event.clientX, y: event.clientY }
  updateCursor()
})
document.documentElement.addEventListener('pointerleave', () => {
  pointer = null
  updateCursor()
})
window.setInterval(() => lineupView.sync({ swarm, bounds }), LINEUP_REFRESH_MS)
document.addEventListener('visibilitychange', applyMotionPreference)
reducedMotion.addEventListener('change', applyMotionPreference)
darkScheme.addEventListener('change', () => {
  colors = readColors()
  render()
})
