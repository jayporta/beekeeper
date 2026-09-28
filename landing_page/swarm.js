import { Bee } from './bee.js'
import { lineupCapacity, slotCenter } from './lineup.js'

const MAX_BEES = 12

/** The bees on the page, and the lineup of caught bees in the order they were caught. */
export class Swarm {
  constructor() {
    /** @type {Bee[]} */
    this.bees = []
    /** @type {Bee[]} */
    this.lineup = []
  }

  /** Whether the swarm has as many bees as it ever will. */
  get isFull() {
    return this.bees.length >= MAX_BEES
  }

  /**
   * Adds a bee, unless the swarm is full.
   * @param {Bee} bee - The bee to add.
   */
  add(bee) {
    if (!this.isFull) this.bees.push(bee)
  }

  /**
   * Adds a bee that flies in from a random edge, unless the swarm is full.
   * @param {{ width: number, height: number }} bounds - The area bees fly in.
   */
  spawn(bounds) {
    this.add(Bee.fromEdge(bounds))
  }

  /**
   * Moves every bee by one frame.
   * @param {number} dt - Seconds since the last frame.
   * @param {{ width: number, height: number }} bounds - The area bees fly in.
   */
  update(dt, bounds) {
    for (const bee of this.bees) bee.update(dt, bounds)
  }

  /**
   * Finds the topmost bee under a point.
   * @param {{ x: number, y: number }} point - A point in CSS pixels.
   * @returns {Bee | null} The bee, or `null` if there's none there.
   */
  beeAt(point) {
    return this.bees.findLast((bee) => bee.contains(point)) ?? null
  }

  /**
   * Shakes a clicked bee and, if it isn't lined up yet and there's room, sends it to the next
   * spot in the lineup.
   * @param {Bee} bee - The clicked bee.
   * @param {{ width: number, height: number }} bounds - The area bees fly in.
   */
  catch(bee, bounds) {
    bee.shake()
    if (this.lineup.includes(bee) || this.lineup.length >= lineupCapacity(bounds)) return
    this.lineup.push(bee)
    bee.park(slotCenter(this.lineup.length - 1, bounds))
  }

  /**
   * Lets one bee out of the lineup to fly again, and closes the gap it leaves.
   * @param {Bee} bee - The bee to release.
   * @param {{ width: number, height: number }} bounds - The area bees fly in.
   */
  release(bee, bounds) {
    this.lineup = this.lineup.filter((linedUp) => linedUp !== bee)
    bee.release(bounds)
    this.#arrange(bounds)
  }

  /**
   * Keeps bees inside the page and the lineup laid out for its size, such as after a resize.
   * Bees that no longer fit in the lineup are released.
   * @param {{ width: number, height: number }} bounds - The area bees fly in.
   * @returns {Bee[]} The bees released because they no longer fit.
   */
  fit(bounds) {
    const released = this.lineup.splice(lineupCapacity(bounds))
    for (const bee of released) bee.release(bounds)
    for (const bee of this.bees) bee.keepInside(bounds)
    this.#arrange(bounds)
    return released
  }

  /**
   * Jumps lined-up bees and just-released bees straight to their spots, for when motion is
   * reduced. Other bees stay where they are.
   * @param {Bee[]} released - Bees just let out of the lineup.
   */
  settle(released) {
    for (const bee of [...this.lineup, ...released]) bee.snap()
  }

  #arrange(bounds) {
    this.lineup.forEach((bee, index) => bee.park(slotCenter(index, bounds)))
  }
}
