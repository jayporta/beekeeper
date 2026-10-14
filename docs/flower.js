// The footer daisy releases the bees game over the page and sends the bees home again. A classic
// script that loads the game with a dynamic import(), because the game is made of ES modules.
// Browsers refuse to load modules from file: pages, so opening docs/index.html straight from disk
// leaves the daisy with a note instead of bees. Over http (GitHub Pages, a local static server)
// the game loads once, on the first click.

const RELEASE_LABEL = 'Release the bees'
const HOME_LABEL = 'Send the bees home'
const UNAVAILABLE_NOTE = "The bees can't load here. Serve the site over http to play."

const flower = document.querySelector('.flower')
const status = document.querySelector('.flower-status')

/** @type {{ dismiss: () => Promise<void>, destroy: () => void } | null} */
let game = null
let busy = false
/** @type {Element[]} */
let inertParts = []

/**
 * Everything on the page except the daisy, its note, and the game's own layers, so a click
 * meant for a bee can't follow a link or start a download while the bees are out.
 */
function pageParts() {
  const isGame = (el) => el.classList.contains('bee-swarm') || el.classList.contains('bee-lineup')
  const outside = [...document.body.children].filter(
    (el) => !el.contains(flower) && el.tagName !== 'SCRIPT' && !isGame(el)
  )
  const beside = [...flower.parentElement.children].filter((el) => el !== flower && el !== status)
  return [...outside, ...beside]
}

function setPageInert(on) {
  for (const el of inertParts) el.inert = false
  inertParts = on ? pageParts() : []
  for (const el of inertParts) el.inert = true
}

/** Where the daisy's center is, in viewport pixels. */
function flowerCenter() {
  const box = flower.getBoundingClientRect()
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
}

function createLayers() {
  const canvas = document.createElement('canvas')
  canvas.className = 'bee-swarm'
  canvas.setAttribute('aria-hidden', 'true')
  const lineupLayer = document.createElement('div')
  lineupLayer.className = 'bee-lineup'
  document.body.append(canvas, lineupLayer)
  return { canvas, lineupLayer }
}

async function release() {
  const { createGame } = await import('./bees/game.js')
  const layers = createLayers()
  const created = createGame({ ...layers, getOrigin: flowerCenter })
  const remove = () => {
    layers.canvas.remove()
    layers.lineupLayer.remove()
  }
  game = {
    dismiss: () => created.dismiss().then(remove),
    destroy: () => {
      created.destroy()
      remove()
    }
  }
  created.start()
  setPageInert(true)
  flower.setAttribute('aria-label', HOME_LABEL)
}

async function sendHome() {
  const ending = game
  game = null
  try {
    await ending.dismiss()
  } finally {
    setPageInert(false)
    flower.setAttribute('aria-label', RELEASE_LABEL)
  }
}

flower.addEventListener('click', async () => {
  if (busy) return
  busy = true
  status.textContent = ''
  try {
    if (game) await sendHome()
    else await release()
  } catch {
    status.textContent = UNAVAILABLE_NOTE
  } finally {
    busy = false
  }
})
