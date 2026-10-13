/** A node the test `h` builds: the type it was called with, its props, and its children. */
export interface TestNode {
  readonly type: unknown
  readonly props: Record<string, unknown>
  readonly children: readonly unknown[]
}

/**
 * Stands in for the engine's `h` in tests: records the element instead of drawing it.
 *
 * @param type - The element constructor or tag the JSX named.
 * @param props - The element's props, or null when it has none.
 * @param children - The element's children, in order.
 * @returns The recorded node.
 */
export function testH(
  type: unknown,
  props: Record<string, unknown> | null,
  ...children: unknown[]
): TestNode {
  return { type, props: props ?? {}, children }
}

/** Installs {@link testH} as the global `h` the compiled JSX calls. */
export function installTestH(): void {
  Object.assign(globalThis, { h: testH })
}

/** Removes the global `h` that {@link installTestH} installed. */
export function removeTestH(): void {
  Reflect.deleteProperty(globalThis, 'h')
}

/** Every string in a drawn tree, in order, joined: what a person would read. */
export function textOf(node: unknown): string {
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (node !== null && typeof node === 'object' && 'children' in node) {
    return textOf((node as TestNode).children)
  }
  return ''
}

/** Every node in a drawn tree whose type is `type`, in order. */
export function findAll(node: unknown, type: unknown): TestNode[] {
  if (Array.isArray(node)) return node.flatMap((child) => findAll(child, type))
  if (node === null || typeof node !== 'object' || !('children' in node)) return []
  const found = node as TestNode
  return [...(found.type === type ? [found] : []), ...findAll(found.children, type)]
}
