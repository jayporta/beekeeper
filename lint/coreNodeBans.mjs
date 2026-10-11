// @ts-check
import { builtinModules } from 'node:module'
import { networkBannedImports } from './networkBans.mjs'
const NODE_IMPORT_MESSAGE =
  'core reaches the file system through fileSystem() from src/core/io; only src/core/io/node may import node modules.'

const NODE_GLOBAL_MESSAGE =
  "not available in the mod's runtime; use Uint8Array, an option, or the port"

/**
 * The Node imports core may not make, as the `patterns` option of
 * `no-restricted-imports`: everything behind the `node:` prefix.
 *
 * @type {{ group: string[], message: string }[]}
 */
export const coreBannedImportPatterns = [{ group: ['node:*'], message: NODE_IMPORT_MESSAGE }]

/** The bare names the network bans already report, so core doesn't report them twice. */
const networkNames = new Set(networkBannedImports.map((entry) => entry.name))

/**
 * Every built-in module core could reach without the `node:` prefix (`fs`,
 * `fs/promises`, `crypto`, ...), as the `paths` option of
 * `no-restricted-imports`. Internal `_` modules and the network modules,
 * which keep their own message, are left out.
 *
 * @type {{ name: string, message: string }[]}
 */
export const coreBannedImportPaths = builtinModules
  .filter((name) => !name.startsWith('_') && !name.startsWith('node:') && !networkNames.has(name))
  .map((name) => ({ name, message: NODE_IMPORT_MESSAGE }))

/**
 * The Node globals core may not use, as `no-restricted-globals` entries.
 * `setTimeout` stays allowed: the mod's runtime has it.
 *
 * @type {{ name: string, message: string }[]}
 */
export const coreBannedGlobals = [
  'Buffer',
  'process',
  'setImmediate',
  '__dirname',
  '__filename',
  'require',
  'global'
].map((name) => ({ name, message: NODE_GLOBAL_MESSAGE }))
