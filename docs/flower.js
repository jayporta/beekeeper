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
  flower.setAttribute('aria-label', HOME_LABEL)
}

async function sendHome() {
  const ending = game
  game = null
  await ending.dismiss()
  flower.setAttribute('aria-label', RELEASE_LABEL)
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
