import { readFileSync } from 'node:fs'

/** Resolved color-token values for one color scheme, keyed by custom property name (`--color-bg`). */
export type TokenValues = Record<string, string>

const DARK_BLOCK = /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root\s*\{([^}]*)\}\s*\}/
const ROOT_BLOCK = /:root\s*\{([^}]*)\}/

function declarations(block: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const match of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    const [, name, value] = match
    if (name !== undefined && value !== undefined) result[name] = value.trim()
  }
  return result
}

function resolve(name: string, raw: Record<string, string>, seen: readonly string[] = []): string {
  const value = raw[name]
  if (value === undefined) throw new Error(`Token ${name} is not declared`)
  if (seen.includes(name)) throw new Error(`Token ${name} references itself`)
  const reference = /^var\((--[\w-]+)\)$/.exec(value)
  return reference?.[1] === undefined ? value : resolve(reference[1], raw, [...seen, name])
}

function resolveAll(raw: Record<string, string>): TokenValues {
  return Object.fromEntries(Object.keys(raw).map((name) => [name, resolve(name, raw)]))
}

/**
 * Reads a tokens stylesheet and resolves every custom property, following `var()` references, for
 * the light scheme and for the dark scheme (the `:root` block under `prefers-color-scheme: dark`
 * laid over the light one).
 *
 * @param path - Absolute path or `file:` URL of the stylesheet.
 * @returns The resolved values for each scheme.
 * @throws {Error} When the stylesheet has no `:root` block or a reference cannot be resolved.
 */
export function readTokenSchemes(path: string | URL): { light: TokenValues; dark: TokenValues } {
  const css = readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const darkBlock = DARK_BLOCK.exec(css)?.[1]
  const lightBlock = ROOT_BLOCK.exec(css.replace(DARK_BLOCK, ''))?.[1]
  if (lightBlock === undefined || darkBlock === undefined) {
    throw new Error('The tokens stylesheet needs a :root block and a dark-mode :root block')
  }
  const light = declarations(lightBlock)
  return { light: resolveAll(light), dark: resolveAll({ ...light, ...declarations(darkBlock) }) }
}
