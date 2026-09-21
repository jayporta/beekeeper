/**
 * Finds every node that sits on a cycle of parent links, in one pass over
 * `parentOf` (each node is visited once, since every walk stops the moment
 * it reaches an already-visited node).
 *
 * Since each node has at most one outgoing link, an iterative walk from an
 * unvisited node either dead-ends, reaches a node already resolved by an
 * earlier walk, or reaches back into its own walk. Only the last case is a
 * cycle, and only the suffix of the walk from the repeated node onward is
 * on it: a node earlier in the same walk merely leads into that cycle.
 *
 * @param parentOf - Each node's single parent link, keyed by node id.
 * @returns The ids that are themselves part of a cycle.
 */
export function findCycleMembers(parentOf: ReadonlyMap<string, string>): ReadonlySet<string> {
  const resolved = new Set<string>()
  const onCycle = new Set<string>()

  for (const start of parentOf.keys()) {
    if (resolved.has(start)) continue

    // Tracks both the walk's order (for slicing out the cycle suffix) and,
    // via its keys, O(1) membership so each step of the walk below stays
    // O(1) regardless of how long the walk gets.
    const pathIndex = new Map<string, number>()
    const path: string[] = []
    let current: string | undefined = start

    while (current !== undefined && !resolved.has(current) && !pathIndex.has(current)) {
      pathIndex.set(current, path.length)
      path.push(current)
      current = parentOf.get(current)
    }

    const cycleStart = current === undefined ? undefined : pathIndex.get(current)
    if (cycleStart !== undefined) {
      for (const node of path.slice(cycleStart)) onCycle.add(node)
    }

    for (const node of path) resolved.add(node)
  }

  return onCycle
}
