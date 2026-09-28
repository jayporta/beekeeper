import { cardTop } from './lineup.js'

/** Formats a duration as a short "ago" phrase, with tenths of a second while it's short. */
function formatAgo(milliseconds) {
  const seconds = Math.max(0, milliseconds) / 1000
  if (seconds < 10) return `${seconds.toFixed(1)}s ago`
  if (seconds < 60) return `${Math.floor(seconds)}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${Math.floor(seconds % 60)}s ago`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m ago`
}

function setText(node, text) {
  if (node.textContent !== text) node.textContent = text
}

/**
 * Shows a card under each frozen bee in the lineup with when it spawned and when it paused, and a
 * Release button under the card that sends the bee back to flying.
 * @param {{ layer: HTMLElement, onRelease: (bee: import('./bee.js').Bee) => void }} options - The element to put cards in, and what to do when a Release button is clicked.
 * @returns {{ sync: (state: { swarm: import('./swarm.js').Swarm, bounds: { width: number, height: number } }) => void }} A view whose `sync` brings the cards up to date with the swarm.
 */
export function createLineupView({ layer, onRelease }) {
  /**
   * Each shown card's elements, and the last position given to it so it isn't rewritten unchanged.
   * @type {Map<import('./bee.js').Bee, { group: HTMLElement, spawned: HTMLElement, paused: HTMLElement, translate: string }>}
   */
  const cards = new Map()

  function place(entry, { x, y }) {
    const translate = `${Math.round(x)}px ${Math.round(y)}px`
    if (entry.translate === translate) return
    entry.translate = translate
    entry.group.style.translate = translate
  }

  function createCard(bee) {
    const group = document.createElement('div')
    group.className = 'lineup-item'
    const card = document.createElement('p')
    card.className = 'card'
    const spawned = document.createElement('span')
    const paused = document.createElement('span')
    card.append(spawned, paused)

    const release = document.createElement('button')
    release.type = 'button'
    release.className = 'release'
    const hint = document.createElement('span')
    hint.className = 'visually-hidden'
    hint.textContent = ' this bee'
    release.append('Release', hint)
    release.addEventListener('click', () => {
      // The group is removed on release, so keep keyboard focus on a neighboring Release button.
      const neighbor = group.nextElementSibling ?? group.previousElementSibling
      onRelease(bee)
      neighbor?.querySelector('.release')?.focus()
    })

    group.append(card, release)
    layer.append(group)
    return { group, spawned, paused, translate: '' }
  }

  function sync({ swarm, bounds }) {
    const now = performance.now()
    const shown = new Set()
    swarm.lineup.forEach((bee, index) => {
      if (!bee.isParked) return
      shown.add(bee)
      let entry = cards.get(bee)
      if (!entry) {
        entry = createCard(bee)
        cards.set(bee, entry)
      }
      place(entry, cardTop(index, bounds))
      setText(entry.spawned, `Spawned: ${formatAgo(now - bee.spawnedAt)}`)
      setText(entry.paused, `Paused: ${formatAgo(now - bee.pausedAt)}`)
    })
    for (const [bee, entry] of cards) {
      if (shown.has(bee)) continue
      entry.group.remove()
      cards.delete(bee)
    }
    keepLineupOrder(swarm.lineup)
  }

  /** Puts cards in lineup order in the page, so Tab order and neighbors follow the rows. */
  function keepLineupOrder(lineup) {
    const groups = lineup.filter((bee) => cards.has(bee)).map((bee) => cards.get(bee).group)
    if (groups.every((group, index) => layer.children[index] === group)) return
    const focused = document.activeElement
    layer.append(...groups)
    if (focused instanceof HTMLElement && layer.contains(focused)) focused.focus()
  }

  return { sync }
}
